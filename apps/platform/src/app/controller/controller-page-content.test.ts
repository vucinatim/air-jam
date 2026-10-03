// @vitest-environment jsdom

import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ControllerPageContent } from "./controller-page-content";
import type { ControllerPageLayout } from "./controller-page-layout";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  surface: { kind: "browser", epoch: 3 },
  controller: {
    socket: { connected: true, emit: vi.fn() },
    roomId: "ROOM",
    connectionStatus: "connected",
  },
  activeUrl: null as string | null,
}));
let layout: ComponentProps<typeof ControllerPageLayout>;
vi.mock("./controller-page-layout", () => ({
  ControllerPageLayout: (
    props: ComponentProps<typeof ControllerPageLayout>,
  ) => {
    layout = props;
    return null;
  },
}));
// Deliberately no useInputWriter or useControllerTick: the shell must not
// acquire the gameplay input publisher, even while its surface is hydrating.
vi.mock("@air-jam/sdk", () => ({
  useAirJamController: () => mocks.controller,
}));
vi.mock("@/components/arcade/arcade-surface-store", () => ({
  useArcadeSurfaceStore: { getState: () => mocks.surface },
}));
vi.mock("./use-controller-embedded-game-frame", () => ({
  useControllerEmbeddedGameFrame: () => ({ activeUrl: mocks.activeUrl }),
}));
vi.mock("@/lib/use-document-fullscreen", () => ({
  useDocumentFullscreen: () => false,
}));
vi.mock("@/lib/controller-local-settings", () => ({
  useControllerLocalSettings: () => ({
    settings: { hapticsEnabled: false },
    updateSettings: vi.fn(),
  }),
}));

describe("Arcade controller menu commands", () => {
  let root: Root;
  let container: HTMLDivElement;
  const render = () =>
    act(() =>
      root.render(
        createElement(ControllerPageContent, {
          routeRoomId: "ROOM",
          hasControllerCapability: false,
          surfaceMode: "default",
        }),
      ),
    );
  const release = () => {
    layout.onMove({ x: 0, y: 0 });
    layout.onConfirmRelease();
  };
  const expectCommand = (actionName: string, payload: unknown) => {
    expect(mocks.emit).toHaveBeenLastCalledWith("controller:action_rpc", {
      roomId: "ROOM",
      storeDomain: "arcade.surface",
      actionName,
      payload,
    });
  };
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mocks.emit.mockReset();
    mocks.controller.socket = { connected: true, emit: mocks.emit };
    mocks.controller.roomId = "ROOM";
    mocks.controller.connectionStatus = "connected";
    mocks.surface = { kind: "browser", epoch: 3 };
    mocks.activeUrl = null;
    container = document.createElement("div");
    root = createRoot(container);
    render();
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  it("does not publish anything merely by mounting or rerendering", () => {
    render();
    render();
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it("sends one semantic move per activation, with vertical priority", () => {
    layout.onMove({ x: 0.5, y: -0.5 });
    expect(mocks.emit).not.toHaveBeenCalled();
    layout.onMove({ x: 1, y: -1 });
    expectCommand("airjam.arcade.navigate", { epoch: 3, direction: "up" });
    layout.onMove({ x: 1, y: 0 });
    layout.onMove({ x: -1, y: 0 });
    expect(mocks.emit).toHaveBeenCalledTimes(1);
    release();
    layout.onMove({ x: -1, y: 0 });
    expectCommand("airjam.arcade.navigate", { epoch: 3, direction: "left" });
    expect(mocks.emit).toHaveBeenCalledTimes(2);
  });

  it("never repeats a held confirm after failure; release enables an explicit retry", () => {
    layout.onConfirm();
    expectCommand("airjam.arcade.confirm", { epoch: 3 });
    render();
    layout.onConfirm();
    expect(mocks.emit).toHaveBeenCalledTimes(1);
    release();
    layout.onConfirm();
    expect(mocks.emit).toHaveBeenCalledTimes(2);
  });

  it("reads the live surface at gesture time, not an earlier React render", () => {
    mocks.surface = { kind: "browser", epoch: 9 };
    layout.onConfirm();
    expectCommand("airjam.arcade.confirm", { epoch: 9 });
    release();
    mocks.surface = { kind: "game", epoch: 10 };
    layout.onConfirm();
    layout.onMove({ x: 1, y: 0 });
    expect(mocks.emit).toHaveBeenCalledTimes(1);
  });

  it("drops menu gestures when a game surface has no controller URL yet", () => {
    mocks.surface = { kind: "game", epoch: 4 };
    render();
    layout.onConfirm();
    layout.onMove({ x: 1, y: 0 });
    expect(mocks.emit).not.toHaveBeenCalled();
  });

  it.each(["socket", "room"])(
    "does not queue gestures with no connected %s",
    (missing) => {
      if (missing === "socket") mocks.controller.socket.connected = false;
      else mocks.controller.roomId = "";
      render();
      layout.onConfirm();
      layout.onMove({ x: 1, y: 0 });
      expect(mocks.emit).not.toHaveBeenCalled();
      mocks.controller.socket.connected = true;
      mocks.controller.roomId = "ROOM";
      render();
      expect(mocks.emit).not.toHaveBeenCalled();
      release();
      layout.onConfirm();
      expect(mocks.emit).toHaveBeenCalledTimes(1);
    },
  );

  it("discards a gesture whose remote unmounted before pointer-up without replay", () => {
    layout.onConfirm();
    mocks.activeUrl = "http://game.test/controller";
    mocks.surface = { kind: "game", epoch: 4 };
    render();
    mocks.activeUrl = null;
    mocks.surface = { kind: "browser", epoch: 5 };
    render();
    expect(mocks.emit).toHaveBeenCalledTimes(1);
    layout.onConfirm();
    expectCommand("airjam.arcade.confirm", { epoch: 5 });
    expect(mocks.emit).toHaveBeenCalledTimes(2);
  });
});
