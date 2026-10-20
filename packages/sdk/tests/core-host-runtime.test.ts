// Runs in plain Node: the core host runtime needs no React and no DOM.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createConnectionStore,
  HostRuntime,
  type AirJamHostEnvironment,
} from "../src/core";
import { InputManager } from "../src/internal/input-manager";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";

type Listener = (...args: unknown[]) => void;

const createServerSocket = () => {
  const listeners = new Map<string, Set<Listener>>();
  const fire = (event: string, ...args: unknown[]) => {
    for (const listener of listeners.get(event) ?? []) listener(...args);
  };
  const socket = {
    connected: false,
    id: "host-socket",
    on: (event: string, listener: Listener) => {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
      return socket;
    },
    off: (event: string, listener?: Listener) => {
      if (listener) listeners.get(event)?.delete(listener);
      else listeners.delete(event);
      return socket;
    },
    connect: () => {
      socket.connected = true;
      fire("connect");
      return socket;
    },
    disconnect: () => {
      socket.connected = false;
      fire("disconnect", "io client disconnect");
      return socket;
    },
    emit: vi.fn((event: string, ...args: unknown[]) => {
      const acknowledge = args.at(-1);
      if (event === "host:createRoom" && typeof acknowledge === "function")
        acknowledge({
          ok: true,
          roomId: "ROOM1",
          players: [],
          controllers: [],
          hostResumeCapability: { token: "resume-token" },
        });
      return socket;
    }),
    emitWithAck: async <TAck>(event: string): Promise<TAck> => {
      if (event === "host:bootstrap")
        return { ok: true, traceId: "trace-1" } as TAck;
      throw new Error(`Unexpected ${event}`);
    },
    fire,
    listenerCount: () =>
      [...listeners.values()].reduce((total, set) => total + set.size, 0),
  };
  return socket;
};

const createMemoryEnvironment = (
  socket: ReturnType<typeof createServerSocket>,
) => {
  let resume: { roomId: string; token: string } | null = null;
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    controlTarget: {},
    readResume: () => resume,
    writeResume: (next) => {
      resume = next;
    },
    requestHostGrant: async () => "grant",
    controllerUrl: async (roomId) =>
      `https://play.test/controller?room=${roomId}`,
    transport: () => socket,
    emitDevEvent: () => {},
    setDevLogContext: () => {},
  };
  return { environment, readStoredResume: () => resume };
};

const config = resolveAirJamConfig({
  topology: resolveRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "host",
    appOrigin: "https://play.test",
    backendOrigin: "https://api.play.test",
    publicHost: "https://play.test",
  }),
  appId: "app_test",
  resolveEnv: false,
});

const inputSchema = z.object({ direction: z.number() });

describe("core host runtime", () => {
  it("creates a room, reads input and stops cleanly without React or DOM", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe(
      "undefined",
    );
    const socket = createServerSocket();
    const { environment, readStoredResume } = createMemoryEnvironment(socket);
    const store = createConnectionStore();
    const joined = vi.fn();
    const runtime = new HostRuntime<typeof inputSchema>(
      {
        config,
        store,
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
        inputManager: new InputManager({ schema: inputSchema }),
        environment,
      },
      { onPlayerJoin: joined },
    );

    const stop = runtime.start();
    await vi.waitFor(() =>
      expect(store.getState().connectionStatus).toBe("connected"),
    );
    expect(runtime.roomId).toBe("ROOM1");
    expect(readStoredResume()).toEqual({
      roomId: "ROOM1",
      token: "resume-token",
    });
    await vi.waitFor(() =>
      expect(store.getState()).toMatchObject({
        joinUrl: "https://play.test/controller?room=ROOM1",
        joinUrlStatus: "ready",
      }),
    );

    const player = { id: "ctrl_1", label: "One", color: "#ff0000" };
    socket.fire("server:controllerJoined", {
      controllerId: "ctrl_1",
      source: "phone",
      connected: true,
      resumeLeaseExpiresAt: null,
      player,
    });
    socket.fire("server:input", {
      roomId: "ROOM1",
      controllerId: "ctrl_1",
      input: { direction: 1 },
    });
    expect(store.getState().players).toEqual([player]);
    expect(runtime.getInput("ctrl_1")).toEqual({ direction: 1 });
    await vi.waitFor(() => expect(joined).toHaveBeenCalledWith(player));

    expect(runtime.sendState({ runtimeState: "paused" })).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith("host:state", {
      roomId: "ROOM1",
      state: { runtimeState: "paused" },
    });

    stop();
    expect(socket.listenerCount()).toBe(0);
  });
});
