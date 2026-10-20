// Runs in plain Node: the core host runtime needs no React and no DOM.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "../src/agent/agent-contract";
import {
  createAirJamStore,
  createConnectionStore,
  defineAirJamSimulation,
  HostRuntime,
  type AirJamActionContext,
  type AirJamHostEnvironment,
} from "../src/core";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";
import { createMemorySocket } from "./fixtures/memory-socket";

const createServerSocket = () =>
  createMemorySocket((event) => {
    if (event === "host:bootstrap") return { ok: true, traceId: "trace-1" };
    if (event === "host:createRoom")
      return {
        ok: true,
        roomId: "ROOM1",
        players: [],
        controllers: [],
        hostResumeCapability: { token: "resume-token" },
      };
    throw new Error(`Unexpected ${event}`);
  });

const createMemoryEnvironment = (
  socket: ReturnType<typeof createServerSocket>,
) => {
  let resume: { roomId: string; token: string } | null = null;
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: "default",
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
    seed: () => 1,
    now: () => performance.now(),
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

const createScoreStore = () =>
  createAirJamStore<{
    score: number;
    actions: {
      score: (ctx: AirJamActionContext, payload: { by: number }) => void;
    };
  }>((set) => ({
    score: 0,
    actions: {
      score: (_ctx, { by }) => set((state) => ({ score: state.score + by })),
    },
  }));

describe("core host runtime", () => {
  it("creates a room, reads input and stops cleanly without React or DOM", async () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe(
      "undefined",
    );
    const socket = createServerSocket();
    const { environment, readStoredResume } = createMemoryEnvironment(socket);
    const store = createConnectionStore();
    const joined = vi.fn();
    const scores = createScoreStore();
    const runtime = new HostRuntime<typeof inputSchema>(
      {
        config,
        store,
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
        input: { schema: inputSchema },
        environment,
        stores: [scores],
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

    // The store syncs with the room although no component reads it.
    expect(scores.attached).toBe(true);
    await scores.actions.score({ by: 2 });
    expect(socket.emit).toHaveBeenLastCalledWith(
      "host:state_sync",
      expect.objectContaining({ roomId: "ROOM1", data: { score: 2 } }),
    );

    stop();
    expect(scores.attached).toBe(false);
    expect(socket.listenerCount()).toBe(0);
  });

  it("publishes the agent contract and the simulation's declared view on the host clock", async () => {
    const socket = createServerSocket();
    const { environment } = createMemoryEnvironment(socket);
    let gameMs = 0;
    const headless = { ...environment, now: () => gameMs };
    const scores = createScoreStore();
    const walker = defineAirJamSimulation<
      { x: number },
      z.infer<typeof inputSchema>
    >({
      stepMs: 10,
      create: () => ({ x: 0 }),
      step: (sim, { input }) => {
        sim.x += input("ctrl_1")?.direction ?? 0;
      },
      observe: (sim) => ({ x: sim.x }),
    });
    const runtime = new HostRuntime<typeof inputSchema>({
      config,
      store: createConnectionStore(),
      getSocket: () => {
        throw new Error("The memory transport needs no socket.");
      },
      disconnectSocket: () => {},
      input: { schema: inputSchema },
      environment: headless,
      stores: [scores],
      simulation: walker,
      agent: {
        gameId: "walker",
        contract: defineAirJamAgentContract({
          stores: defineAirJamAgentStores({
            default: agentStore<{ score: number }>(),
          }),
          projectSnapshot: ({ stores }) => ({
            score: stores.default?.score ?? null,
          }),
          actions: {},
        }),
      },
    });
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    socket.fire("server:input", {
      roomId: "ROOM1",
      controllerId: "ctrl_1",
      input: { direction: 1 },
    });
    gameMs = 50;
    runtime.simulation?.advance(50);

    const control = Reflect.get(
      headless.controlTarget,
      AIR_JAM_RUNTIME_CONTROL_KEY,
    ) as HostRuntimeControl;
    const response = await control.agent({
      operation: "observe",
      roomId: "ROOM1",
      controllerId: null,
      scope: "diagnostic",
      includeImage: false,
    });
    if (response.operation !== "observe") throw new Error("Expected observe.");
    expect(response.observation).toMatchObject({
      snapshot: { score: 0 },
      runtime: { x: 5 },
      ticks: { after: 5 },
      clock: { startedAtMs: 50, finishedAtMs: 50 },
      visual: { status: "unavailable", reason: "not-requested" },
    });

    stop();
    await expect(
      control.agent({
        operation: "observe",
        roomId: "ROOM1",
        controllerId: null,
        scope: "diagnostic",
        includeImage: false,
      }),
    ).rejects.toThrow();
  });
});
