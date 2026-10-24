// Runs in plain Node: the core controller runtime needs no React and no DOM.
import { describe, expect, it, vi } from "vitest";
import {
  axis,
  button,
  ControllerRuntime,
  createConnectionStore,
  defineAirJamInput,
  stick,
  type AirJamControllerEnvironment,
  type ControllerRoomBinding,
} from "../src/core";
import { createMemorySocket } from "./fixtures/memory-socket";

const createMemoryEnvironment = (
  socket: ReturnType<typeof createMemorySocket>,
) => {
  const bindings = new Map<string, ControllerRoomBinding>();
  const vibrate = vi.fn();
  const frames: (() => void)[] = [];
  const environment: AirJamControllerEnvironment = {
    embedded: null,
    requestedRoomId: "ROOM1",
    requestedControllerId: null,
    capabilityToken: null,
    deviceId: "device-1",
    leaveOnStop: false,
    runMode: "standalone",
    defaultStoreDomain: "default",
    readBinding: (roomId) => bindings.get(roomId) ?? null,
    writeBinding: (roomId, binding) => bindings.set(roomId, binding),
    clearBinding: (roomId) => bindings.delete(roomId),
    vibrate,
    requestFrame: (callback) => frames.push(callback),
    transport: () => socket,
    emitDevEvent: () => {},
    setDevLogContext: () => {},
  };
  const nextFrame = () => {
    for (const frame of frames.splice(0)) frame();
  };
  return { environment, bindings, vibrate, nextFrame };
};

describe("core controller runtime", () => {
  it("joins a seat, follows the room and leaves without React or DOM", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe(
      "undefined",
    );
    const socket = createMemorySocket((event, payload) => {
      if (event === "controller:join")
        return {
          ok: true,
          controllerId: (payload as { controllerId: string }).controllerId,
          resumeCapabilityToken: "seat-token",
        };
      if (event === "controller:leave") return { ok: true };
      throw new Error(`Unexpected ${event}`);
    });
    const { environment, bindings, vibrate } = createMemoryEnvironment(socket);
    const store = createConnectionStore();
    const runtime = new ControllerRuntime(
      {
        store,
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
        environment,
        stores: [],
      },
      { controllerId: "ctrl_1" },
    );
    const states = vi.fn();
    runtime.setNickname("Ada");
    runtime.setStateListener(states);

    const stop = runtime.start();
    expect(store.getState()).toMatchObject({
      connectionStatus: "connected",
      controllerId: "ctrl_1",
      roomId: "ROOM1",
    });
    expect(socket.emit).toHaveBeenCalledWith(
      "controller:join",
      expect.objectContaining({
        roomId: "ROOM1",
        controllerId: "ctrl_1",
        deviceId: "device-1",
        nickname: "Ada",
      }),
      expect.any(Function),
    );
    expect(bindings.get("ROOM1")).toEqual({
      controllerId: "ctrl_1",
      resumeCapabilityToken: "seat-token",
    });

    const player = { id: "ctrl_1", label: "Ada" };
    socket.fire("server:welcome", { roomId: "ROOM1", players: [], player });
    socket.fire("server:state", {
      roomId: "ROOM1",
      state: { runtimeState: "paused", stateVersion: 1 },
    });
    socket.fire("server:signal", {
      type: "HAPTIC",
      payload: { pattern: "heavy" },
    });
    expect(store.getState().players).toEqual([player]);
    expect(store.getState().runtimeState).toBe("paused");
    expect(states).toHaveBeenCalledWith({
      runtimeState: "paused",
      stateVersion: 1,
    });
    expect(vibrate).toHaveBeenCalledWith([50, 20, 50]);

    await expect(runtime.leave()).resolves.toEqual({ ok: true });
    expect(store.getState().controllerId).toBeNull();
    expect(bindings.size).toBe(0);

    stop();
    expect(socket.listenerCount()).toBe(0);
  });

  it("sends its declared controls once per frame when they change, and again after joining", () => {
    const socket = createMemorySocket((event, payload) => {
      if (event === "controller:join")
        return {
          ok: true,
          controllerId: (payload as { controllerId: string }).controllerId,
          resumeCapabilityToken: "seat-token",
        };
      return undefined;
    });
    const { environment, nextFrame } = createMemoryEnvironment(socket);
    const runtime = new ControllerRuntime(
      {
        store: createConnectionStore(),
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
        environment,
        stores: [],
        input: defineAirJamInput({
          paddle: axis(),
          fire: button("pressed"),
          move: stick(),
        }),
      },
      { controllerId: "ctrl_1" },
    );
    const stop = runtime.start();
    const sent = () =>
      socket.emit.mock.calls
        .filter(([event]) => event === "controller:input")
        .map(([, payload]) => (payload as { input: unknown }).input);
    const neutral = {
      paddle: 0,
      fire: { down: false, presses: 0 },
      move: { x: 0, y: 0 },
    };
    expect(sent()).toEqual([neutral]);

    const controls = runtime.input;
    if (!controls) throw new Error("Expected declared controls.");
    const releaseUp = controls.hold("paddle", -1);
    const releaseDown = controls.hold("paddle", 1);
    controls.press("fire")();
    controls.set("move", { x: 0.333, y: 2 });
    expect(sent()).toHaveLength(1);
    nextFrame();
    expect(sent().at(-1)).toEqual({
      paddle: 1,
      fire: { down: false, presses: 1 },
      move: { x: 0.33, y: 1 },
    });

    releaseDown();
    nextFrame();
    expect(sent().at(-1)).toMatchObject({ paddle: -1 });
    releaseUp();
    controls.releaseAll();
    nextFrame();
    expect(sent().at(-1)).toEqual({
      ...neutral,
      fire: { down: false, presses: 1 },
    });
    expect(() => controls.press("paddle")).toThrow(/not a declared button/);
    stop();
  });
});
