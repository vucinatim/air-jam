// @vitest-environment jsdom
import {
  parseRuntimeTopologyFromSearchParams,
  resolveRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { JoinQrOverlay } from "../src/components/join-qr-overlay";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import { createBrowserHostEnvironment } from "../src/runtime/browser-host-environment";

describe("host join urls", () => {
  it("carries the development host's transport into a phone's join link without its embedding", async () => {
    const topology = resolveRuntimeTopology({
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: "http://human.localhost:8791",
      backendOrigin: "http://human.localhost:8791",
      embedded: true,
      embedParentOrigin: "http://studio.localhost:3000",
    });
    const environment = createBrowserHostEnvironment(
      resolveAirJamConfig({ topology, resolveEnv: false }),
    );
    const url = new URL(await environment.controllerUrl("ROOM1"));
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
