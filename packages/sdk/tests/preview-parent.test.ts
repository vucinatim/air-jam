// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createConnectionStore } from "../src/core/connection-store";
import type { ControllerRuntime } from "../src/core/controller-runtime";
import type { LocalInputTarget } from "../src/core/local-input";
import {
  AIR_JAM_PREVIEW_CLOSE_REQUEST,
  AIR_JAM_PREVIEW_CLOSE_RESULT,
  AIR_JAM_PREVIEW_SEAT,
} from "../src/preview/messages";
import {
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "../src/runtime-topology";
import { followPreviewParent } from "../src/runtime/browser-controller-environment";
import {
  listenForLocalSeatInput,
  relayLocalSeatInput,
} from "../src/runtime/local-seats";

const studio = "https://studio.example";
const originalParent = window.parent;
afterEach(() => {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: originalParent,
  });
  window.history.replaceState({}, "", "/");
});

/** Frames this page as a preview phone launched with the given query. */
const framePhone = (query: string) => {
  window.history.replaceState(
    {},
    "",
    `/controller?room=ROOM&aj_preview=1&aj_preview_device=pd_preview_1${query}`,
  );
  const parent = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  return parent;
};
const fromParent = (parent: Window, origin: string, data: unknown) =>
  window.dispatchEvent(
    new MessageEvent("message", { source: parent, origin, data }),
  );
const target = () =>
  ({
    press: vi.fn(() => () => {}),
    hold: vi.fn(() => () => {}),
    set: vi.fn(),
    releaseAll: vi.fn(),
  }) satisfies LocalInputTarget;
const pressJump = {
  type: "airjam.local-seat.input",
  operation: { op: "press", control: "jump", hold: 1 },
};

describe("a local-seat phone's parent", () => {
  it("takes operations only from the parent origin its launch declares", () => {
    const parent = framePhone(
      `&airjamLocalSeat=Keyboard%201&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const controls = target();
    const stop = listenForLocalSeatInput(controls);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "airjam.local-seat.ready" },
      studio,
    );
    fromParent(parent, window.location.origin, pressJump);
    fromParent(window, studio, pressJump);
    expect(controls.press).not.toHaveBeenCalled();
    fromParent(parent, studio, pressJump);
    expect(controls.press).toHaveBeenCalledWith("jump");
    stop();
  });

  it("takes them from its own origin when none is declared", () => {
    const parent = framePhone("&airjamLocalSeat=Keyboard%201");
    const controls = target();
    const stop = listenForLocalSeatInput(controls);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "airjam.local-seat.ready" },
      window.location.origin,
    );
    fromParent(parent, studio, pressJump);
    expect(controls.press).not.toHaveBeenCalled();
    fromParent(parent, window.location.origin, pressJump);
    expect(controls.press).toHaveBeenCalledWith("jump");
    stop();
  });

  it("ignores its parent unless it was launched as a seat", () => {
    const parent = framePhone(
      `&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const controls = target();
    listenForLocalSeatInput(controls)();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });
});

describe("a local seat through a phone page that frames its game's controller", () => {
  it("the game's controller takes operations only from its declared embed parent", () => {
    const shell = "https://platform.example";
    const topology = resolveRuntimeTopology({
      runtimeMode: "arcade-live",
      surfaceRole: "controller",
      appOrigin: window.location.origin,
      backendOrigin: window.location.origin,
      publicHost: window.location.origin,
      assetBasePath: "/",
      embedded: true,
      embedParentOrigin: shell,
      proxyStrategy: "none",
    });
    window.history.replaceState(
      {},
      "",
      `/controller?${new URLSearchParams({ aj_room: "ROOM", aj_controller_id: "controller-1", aj_arcade_epoch: "1", aj_arcade_kind: "game", aj_arcade_game_id: "game", ...runtimeTopologyToQueryParams(topology) })}`,
    );
    const parent = { postMessage: vi.fn() } as unknown as Window;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parent,
    });
    const controls = target();
    const stop = listenForLocalSeatInput(controls);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "airjam.local-seat.ready" },
      shell,
    );
    fromParent(parent, window.location.origin, pressJump);
    expect(controls.press).not.toHaveBeenCalled();
    fromParent(parent, shell, pressJump);
    expect(controls.press).toHaveBeenCalledWith("jump");
    stop();
  });

  it("the page says ready once its game's controller does and passes its seat's operations on", () => {
    const parent = framePhone(
      `&airjamLocalSeat=Keyboard%201&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const game = { postMessage: vi.fn() } as unknown as Window;
    const gameOrigin = "https://game.example";
    const stop = relayLocalSeatInput({
      window: () => game,
      origin: gameOrigin,
    });
    const ready = { type: "airjam.local-seat.ready" };
    fromParent(game, studio, ready);
    expect(parent.postMessage).not.toHaveBeenCalled();
    fromParent(game, gameOrigin, ready);
    expect(parent.postMessage).toHaveBeenCalledWith(ready, studio);
    fromParent(parent, window.location.origin, pressJump);
    expect(game.postMessage).not.toHaveBeenCalled();
    fromParent(parent, studio, pressJump);
    expect(game.postMessage).toHaveBeenCalledWith(pressJump, gameOrigin);
    stop();
  });
});

describe("a preview phone and its parent", () => {
  it("reports its seat, and closes only for its declared parent at that origin", () => {
    const parent = framePhone(
      `&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const store = createConnectionStore();
    const runtime = {
      store,
      isEmbedded: false,
      leave: vi.fn(),
    } as unknown as ControllerRuntime;
    const stop = followPreviewParent(runtime);
    store.getState().setControllerId("p2");
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: AIR_JAM_PREVIEW_SEAT, deviceId: "pd_preview_1", seat: "p2" },
      studio,
    );
    const close = { type: AIR_JAM_PREVIEW_CLOSE_REQUEST };
    fromParent(parent, window.location.origin, close);
    fromParent(window, studio, close);
    expect(runtime.leave).not.toHaveBeenCalled();
    fromParent(parent, studio, close);
    expect(runtime.leave).toHaveBeenCalledOnce();
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: true },
      studio,
    );
    stop();
  });
});
