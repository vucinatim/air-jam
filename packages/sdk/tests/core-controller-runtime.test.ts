// Runs in plain Node: the core controller runtime needs no React and no DOM.
import { describe, expect, it, vi } from "vitest";
import {
  ControllerRuntime,
  createConnectionStore,
  type AirJamControllerEnvironment,
  type ControllerRoomBinding,
} from "../src/core";
import { createMemorySocket } from "./fixtures/memory-socket";

const createMemoryEnvironment = (
  socket: ReturnType<typeof createMemorySocket>,
) => {
  const bindings = new Map<string, ControllerRoomBinding>();
  const vibrate = vi.fn();
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
    transport: () => socket,
    emitDevEvent: () => {},
    setDevLogContext: () => {},
  };
  return { environment, bindings, vibrate };
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
});
