// @vitest-environment jsdom

import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControllerConnectionSurface } from "./controller-connection-surface";
import { ControllerGameFrame } from "./controller-game-frame";

describe("controller recovery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows the failed join reason and reconnects through the SDK", () => {
    const reconnect = vi.fn();
    const openRoom = vi.fn();
    act(() => {
      root.render(
        createElement(ControllerConnectionSurface, {
          controller: {
            connectionStatus: "disconnected",
            lastError: "Room not found",
            reconnect,
          },
          roomId: "ABCD",
          onOpenRoomMenu: openRoom,
        }),
      );
    });
    expect(container.textContent).toContain("Room not found");
    expect(container.textContent).toContain("Unable to connect");
    const buttons = container.querySelectorAll("button");
    act(() => buttons[0]!.click());
    expect(reconnect).toHaveBeenCalledOnce();
    act(() => buttons[1]!.click());
    expect(openRoom).toHaveBeenCalledOnce();
  });

  it.each([
    "transport close",
    "transport error",
    "ping timeout",
    "io client disconnect",
    "io server disconnect",
  ])("keeps transport diagnostic '%s' out of player copy", (lastError) => {
    act(() => {
      root.render(
        createElement(ControllerConnectionSurface, {
          controller: {
            connectionStatus: "disconnected",
            lastError,
            reconnect: vi.fn(),
          },
          roomId: "ABCD",
          onOpenRoomMenu: vi.fn(),
        }),
      );
    });
    expect(container.textContent).toContain("Check your connection");
    expect(container.textContent).not.toContain(lastError);
    expect(container.textContent).toContain("Try again");
  });

  it("guides a controller without a room into the existing room menu", () => {
    const openRoom = vi.fn();
    const reconnect = vi.fn();
    act(() => {
      root.render(
        createElement(ControllerConnectionSurface, {
          controller: { connectionStatus: "idle", reconnect },
          roomId: null,
          onOpenRoomMenu: openRoom,
        }),
      );
    });
    expect(container.textContent).toContain("Scan the QR code");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    act(() => container.querySelector("button")!.click());
    expect(openRoom).toHaveBeenCalledOnce();
    expect(reconnect).not.toHaveBeenCalled();
  });

  it.each(["idle", "connecting", "reconnecting"] as const)(
    "shows %s room connection progress without premature failure or competing retries",
    (connectionStatus) => {
      act(() => {
        root.render(
          createElement(ControllerConnectionSurface, {
            controller: { connectionStatus, reconnect: vi.fn() },
            roomId: "ABCD",
            onOpenRoomMenu: vi.fn(),
          }),
        );
      });
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        "Connecting",
      );
      expect(container.textContent).not.toContain("Try again");
      expect(container.textContent).not.toContain("Unable to connect");
    },
  );

  it("reloads only the embedded controller and keeps a delayed frame available to recover", () => {
    let revision = 0;
    const iframeRef = createRef<HTMLIFrameElement>();
    const render = () =>
      root.render(
        createElement(ControllerGameFrame, {
          iframeRef,
          controllerIframeSrc: "https://games.example.test/controller",
          controllerIframePending: false,
          controllerIframeFailed: revision === 0,
          controllerIframeLoading: true,
          controllerIframeRevision: revision,
          onRetry: () => {
            revision += 1;
            render();
          },
        }),
      );
    act(render);
    const initialFrame = container.querySelector("iframe");
    expect(initialFrame).not.toBeNull();
    expect(container.textContent).not.toContain("local Arcade test");
    act(() => container.querySelector("button")!.click());
    expect(container.querySelector("iframe")).not.toBe(initialFrame);
    expect(container.querySelector("iframe")?.src).toBe(
      "https://games.example.test/controller",
    );
    expect(container.textContent).toContain("Loading your controller");
  });
});
