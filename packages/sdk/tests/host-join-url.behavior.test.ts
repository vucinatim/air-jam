// @vitest-environment jsdom
import {
  parseRuntimeTopologyFromSearchParams,
  resolveRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { JoinQrOverlay } from "../src/components/join-qr-overlay";
import { AirJamContext } from "../src/context/air-jam-context";
import { SessionScopeContext } from "../src/context/session-scope";
import { createConnectionStore } from "../src/core/connection-store";
import { useHostRuntimeApi } from "../src/hooks/internal/use-host-runtime-api";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import * as browserHostEnvironment from "../src/runtime/browser-host-environment";
import { createBrowserHostEnvironment } from "../src/runtime/browser-host-environment";
import { createMemoryEnvironment } from "./fixtures/host-environment";

describe("host join urls", () => {
  it("carries the development host's transport into a phone's join link without its embedding", async () => {
    const topology = resolveRuntimeTopology({
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: "http://human.localhost:8791",
      backendOrigin: "http://human.localhost:8791",
      publicHost: "http://192.168.1.2:8791",
      embedded: true,
      embedParentOrigin: "http://studio.localhost:3000",
    });
    const environment = createBrowserHostEnvironment(
      resolveAirJamConfig({ topology, resolveEnv: false }),
    );
    const { joinUrl, localControllerUrl } = await environment.controllerUrls(
      "ROOM1",
      topology,
    );
    expect(new URL(joinUrl).origin).toBe("http://192.168.1.2:8791");
    expect(new URL(localControllerUrl).origin).toBe(topology.appOrigin);
    const url = new URL(joinUrl);
    expect(url.searchParams.get("room")).toBe("ROOM1");
    expect(parseRuntimeTopologyFromSearchParams(url.searchParams)).toEqual(
      resolveRuntimeTopology({
        ...topology,
        surfaceRole: "controller",
        embedded: false,
        embedParentOrigin: undefined,
      }),
    );
  });

  it("updates phone reach without reopening the room or interrupting local controllers", async () => {
    const topology = resolveRuntimeTopology({
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: "http://localhost:3000",
      backendOrigin: "http://localhost:3001",
    });
    const { environment, memory } = createMemoryEnvironment();
    environment.controllerUrls = createBrowserHostEnvironment(
      resolveAirJamConfig({ topology, resolveEnv: false }),
    ).controllerUrls;
    const openRoom = vi.spyOn(environment, "openRoom");
    const closeRoom = vi.spyOn(memory.room, "close");
    const store = createConnectionStore();
    const reportError = vi.fn();
    let config = resolveAirJamConfig({
      topology,
      reportError,
      resolveEnv: false,
    });
    const environmentFactory = vi
      .spyOn(browserHostEnvironment, "createBrowserHostEnvironment")
      .mockImplementation(() => environment);
    const declaration = { stores: [] };
    const { result, rerender, unmount } = renderHook(
      () => useHostRuntimeApi({}, "test host", declaration),
      {
        wrapper: ({ children }: { children: ReactNode }) =>
          createElement(
            SessionScopeContext.Provider,
            { value: "host" },
            createElement(
              AirJamContext.Provider,
              { value: { config, store } },
              children,
            ),
          ),
      },
    );
    try {
      await waitFor(() =>
        expect(store.getState().localControllerUrl).not.toBe(""),
      );
      const localControllerUrl = store.getState().localControllerUrl;
      expect(new URL(localControllerUrl).origin).toBe(topology.appOrigin);
      expect(store.getState().joinUrlStatus).toBe("unavailable");
      expect(store.getState().joinUrl).toBe("");
      config = {
        ...config,
        topology: { ...topology, publicHost: "http://192.168.1.2:12345" },
      };
      rerender();
      expect(store.getState().localControllerUrl).toBe(localControllerUrl);
      await waitFor(() => expect(store.getState().joinUrlStatus).toBe("ready"));
      expect(new URL(store.getState().joinUrl).origin).toBe(
        "http://192.168.1.2:12345",
      );
      config = { ...config, topology };
      rerender();
      expect(store.getState().joinUrlStatus).toBe("unavailable");
      expect(store.getState().joinUrl).toBe("");
      expect(store.getState().localControllerUrl).toBe(localControllerUrl);
      expect(result.current.roomId).toBe("ROOM1");
      expect(environmentFactory).toHaveBeenCalledOnce();
      expect(environmentFactory.mock.calls[0][0].reportError).toBe(reportError);
      expect(openRoom).toHaveBeenCalledOnce();
      expect(closeRoom).not.toHaveBeenCalled();
    } finally {
      unmount();
      environmentFactory.mockRestore();
    }
  });

  it("renders the shared join QR overlay and closes it on backdrop click", () => {
    const onClose = vi.fn();

    render(
      createElement(
        "div",
        { className: "pointer-events-none" },
        createElement(JoinQrOverlay, {
          open: true,
          value: "https://platform.example/controller?room=ROOM1",
          roomId: "ROOM1",
          onClose,
        }),
      ),
    );

    const dialog = screen.getByRole("dialog");

    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain("pointer-events-auto");
    expect(dialog.className).toContain("fixed");
    expect(screen.getByText("ROOM1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^close$/i })).toBeNull();

    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
