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
  it.each(["before", "after", "without server receipt of"] as const)(
    "retains its seat when remounted %s the join acknowledgement",
    (remount) => {
      const firstSocket = createMemorySocket(() => undefined);
      const { environment, bindings } = createMemoryEnvironment(firstSocket);
      let acceptedToken: string | undefined;
      let acknowledgeFirst: (() => void) | undefined;
      const join = (payload: unknown) => {
        const request = payload as {
          controllerId: string;
          resumeCapabilityToken: string;
        };
        if (acceptedToken && request.resumeCapabilityToken !== acceptedToken)
          return { ok: false, message: "invalid_resume_authority" };
        acceptedToken ??= request.resumeCapabilityToken;
        return {
          ok: true,
          controllerId: request.controllerId,
        };
      };
      firstSocket.emit.mockImplementation((event, ...argumentsList) => {
        if (event === "controller:join") {
          const answer =
            remount === "without server receipt of"
              ? { ok: true }
              : join(argumentsList[0]);
          const acknowledge = argumentsList.at(-1);
          if (typeof acknowledge !== "function")
            throw new Error("Expected join acknowledgement.");
          acknowledgeFirst = () => acknowledge(answer);
        }
        return firstSocket;
      });
      const createRuntime = (runtimeEnvironment: AirJamControllerEnvironment) =>
        new ControllerRuntime(
          {
            store: createConnectionStore(),
            environment: runtimeEnvironment,
            getSocket: () => {
              throw new Error("The memory transport owns its socket.");
            },
            disconnectSocket: () => {},
            stores: [],
          },
          { controllerId: "ctrl_remount" },
        );
      const first = createRuntime(environment);
      const stopFirst = first.start();
      if (!acknowledgeFirst) throw new Error("Expected initial join.");
      if (remount === "after") {
        acknowledgeFirst();
        expect(bindings.get("ROOM1")?.resumeCapabilityToken).toBe(
          acceptedToken,
        );
      }
      expect(bindings.get("ROOM1")?.resumeCapabilityToken).toMatch(
        /^[0-9a-f]{64}$/,
      );
      stopFirst();
      expect(
        firstSocket.emit.mock.calls.some(
          ([event]) => event === "controller:leave",
        ),
      ).toBe(false);
      firstSocket.disconnect();

      const secondSocket = createMemorySocket((event, payload) =>
        event === "controller:join" ? join(payload) : undefined,
      );
      const second = createRuntime({
        ...environment,
        transport: () => secondSocket,
      });
      const stopSecond = second.start();
      try {
        expect(second.store.getState()).toMatchObject({
          controllerId: "ctrl_remount",
          connectionStatus: "connected",
          lastError: undefined,
        });
        expect(bindings.get("ROOM1")?.resumeCapabilityToken).toBe(
          acceptedToken,
        );
        acknowledgeFirst();
        expect(
          secondSocket.emit.mock.calls.filter(
            ([event]) => event === "controller:join",
          ),
        ).toHaveLength(1);
      } finally {
        stopSecond();
      }
    },
    1000,
  );

  it("joins a seat, follows the room and leaves without React or DOM", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe(
      "undefined",
    );
    const socket = createMemorySocket((event, payload) => {
      if (event === "controller:join")
        return {
          ok: true,
          controllerId: (payload as { controllerId: string }).controllerId,
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
      resumeCapabilityToken: expect.stringMatching(/^[0-9a-f]{64}$/),
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

  it("reports reconnecting while the transport retries and disconnected when it stops", () => {
    const socket = createMemorySocket((event, payload) =>
      event === "controller:join"
        ? {
            ok: true,
            controllerId: (payload as { controllerId: string }).controllerId,
          }
        : undefined,
    );
    const { environment } = createMemoryEnvironment(socket);
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
    const stop = runtime.start();

    socket.connected = false;
    socket.fire("disconnect", "transport close");
    expect(store.getState()).toMatchObject({
      connectionStatus: "reconnecting",
      lastError: undefined,
    });

    socket.connect();
    expect(store.getState().connectionStatus).toBe("connected");

    socket.connected = false;
    socket.active = false;
    socket.fire("disconnect", "io server disconnect");
    expect(store.getState()).toMatchObject({
      connectionStatus: "disconnected",
      lastError: "io server disconnect",
    });
    stop();
  });
});
