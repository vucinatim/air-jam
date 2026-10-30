// Runs in plain Node: the core host runtime needs no React and no DOM.
import { describe, expect, it, vi } from "vitest";
import {
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "../src/agent/agent-contract";
import {
  axis,
  createAirJamStore,
  createConnectionStore,
  defineAirJamInput,
  defineAirJamSettings,
  defineAirJamSimulation,
  HostRuntime,
  replayAirJamInputLog,
  setting,
  type AirJamActionContext,
  type AirJamHostEnvironment,
  type AirJamInputValues,
  type AirJamSettingsValues,
} from "../src/core";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";
import { hostObservationSchema } from "../src/runtime/contracts/observation";
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

const walkerInput = defineAirJamInput({ direction: axis() });

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
    const runtime = new HostRuntime(
      {
        config,
        store,
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
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
    expect(store.getState().players).toEqual([player]);
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
      AirJamInputValues<typeof walkerInput>
    >({
      stepMs: 10,
      create: () => ({ x: 0 }),
      step: (sim, { input }) => {
        sim.x += input("ctrl_1").direction;
      },
      observe: (sim) => ({ x: sim.x }),
    });
    const runtime = new HostRuntime({
      config,
      store: createConnectionStore(),
      getSocket: () => {
        throw new Error("The memory transport needs no socket.");
      },
      disconnectSocket: () => {},
      input: walkerInput,
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

  it("runs actions on game time: the simulation's when declared, else the host clock", async () => {
    const createTimedStore = () =>
      createAirJamStore<{
        at: number | null;
        actions: {
          mark: (ctx: AirJamActionContext, _payload: undefined) => void;
        };
      }>((set) => ({
        at: null,
        actions: { mark: ({ now }) => set({ at: now }) },
      }));
    const start = async (
      simulation?: ReturnType<typeof defineAirJamSimulation<{ x: number }>>,
    ) => {
      const socket = createServerSocket();
      const { environment } = createMemoryEnvironment(socket);
      const timed = createTimedStore();
      const runtime = new HostRuntime({
        config,
        store: createConnectionStore(),
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
        environment: { ...environment, now: () => 9_000 },
        stores: [timed],
        simulation,
      });
      const stop = runtime.start();
      await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
      return { runtime, timed, stop };
    };

    const simulated = await start(
      defineAirJamSimulation<{ x: number }>({
        stepMs: 10,
        create: () => ({ x: 0 }),
        step: () => {},
      }),
    );
    simulated.runtime.simulation?.advance(35);
    await simulated.timed.actions.mark();
    expect(simulated.timed.getState().at).toBe(30);
    simulated.stop();

    const clocked = await start();
    await clocked.timed.actions.mark();
    expect(clocked.timed.getState().at).toBe(9_000);
    clocked.stop();
  });

  it("records what reached the game by step, and replaying it plays the same match", async () => {
    const createGame = () => {
      const scores = createScoreStore();
      const walker = defineAirJamSimulation<
        { x: number; path: number[] },
        AirJamInputValues<typeof walkerInput>
      >({
        stepMs: 10,
        create: () => ({ x: 0, path: [] }),
        step: (sim, { input, random, tick }) => {
          sim.x += input("ctrl_1").direction + random();
          sim.path.push(sim.x);
          // Outcomes a step causes replay with it rather than from the log.
          if (tick % 7 === 0) void scores.actions.score({ by: 1 });
        },
      });
      return { scores, walker };
    };
    const live = createGame();
    const socket = createServerSocket();
    const { environment } = createMemoryEnvironment(socket);
    let gameMs = 0;
    const runtime = new HostRuntime(
      {
        config,
        store: createConnectionStore(),
        getSocket: () => {
          throw new Error("The memory transport needs no socket.");
        },
        disconnectSocket: () => {},
        environment: { ...environment, now: () => gameMs },
        stores: [live.scores],
        simulation: live.walker,
        input: walkerInput,
      },
      { seed: 3, record: true },
    );
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    const advance = (ms: number) => {
      gameMs += ms;
      runtime.simulation?.advance(ms);
    };
    socket.fire("server:controllerJoined", {
      controllerId: "ctrl_1",
      source: "phone",
      connected: true,
      resumeLeaseExpiresAt: null,
      player: { id: "ctrl_1", label: "One", color: "#ff0000" },
    });
    advance(30);
    socket.fire("server:input", {
      roomId: "ROOM1",
      controllerId: "ctrl_1",
      input: { direction: 1 },
    });
    advance(55);
    socket.fire("airjam:action_rpc", {
      actionName: "score",
      payload: { by: 5 },
      storeDomain: "default",
      actor: { id: "ctrl_1", role: "controller" },
    });
    advance(40);
    socket.fire("server:input", {
      roomId: "ROOM1",
      controllerId: "ctrl_1",
      input: { direction: -0.5 },
    });
    advance(100);
    const log = runtime.inputLog();
    const played = {
      path: [...(runtime.simulation?.sim as { path: number[] }).path],
      score: live.scores.getState().score,
    };
    stop();

    expect(log).toMatchObject({ seed: 3, stepMs: 10, ticks: 22 });
    expect(log.entries.map(({ tick, event }) => [tick, event])).toEqual([
      [1, "server:controllerJoined"],
      [4, "server:input"],
      [9, "airjam:action_rpc"],
      [13, "server:input"],
    ]);
    expect(played.score).toBe(5 + 3);

    const replay = createGame();
    const replayed = await replayAirJamInputLog(
      (dependencies, options) =>
        new HostRuntime(
          {
            ...dependencies,
            stores: [replay.scores],
            simulation: replay.walker,
            input: walkerInput,
          },
          options,
        ),
      JSON.parse(JSON.stringify(log)),
    );
    expect(
      (replayed.runtime.simulation?.sim as { path: number[] }).path,
    ).toEqual(played.path);
    expect(replay.scores.getState().score).toBe(played.score);
    replayed.stop();
  });

  it("shares one settings revision across creation, steps, actions, observation and host control", async () => {
    const settings = defineAirJamSettings({
      speed: setting.number({ default: 2, min: 1, max: 4, live: true }),
      seats: setting.number({ default: 4, min: 2, max: 8 }),
    });
    type Values = AirJamSettingsValues<typeof settings>;
    const values = createAirJamStore<{
      speed: number;
      actions: {
        read: (
          context: AirJamActionContext<Values>,
          payload: undefined,
        ) => void;
      };
    }>((set) => ({
      speed: 0,
      actions: { read: ({ settings }) => set({ speed: settings.speed }) },
    }));
    const simulation = defineAirJamSimulation<
      { created: number; stepped: number },
      Record<string, never>,
      never,
      Values
    >({
      stepMs: 10,
      create: ({ settings }) => ({ created: settings.speed, stepped: 0 }),
      step: (sim, { settings }) => {
        sim.stepped = settings.speed;
      },
      observe: (sim, { settings }) => ({ ...sim, observed: settings.speed }),
    });
    const socket = createServerSocket();
    const { environment } = createMemoryEnvironment(socket);
    const runtime = new HostRuntime(
      {
        config,
        store: createConnectionStore(),
        environment,
        getSocket: () => {
          throw new Error("No socket");
        },
        disconnectSocket: () => {},
        stores: [values],
        simulation,
        settings,
        agent: {
          gameId: "settings",
          contract: defineAirJamAgentContract({
            stores: defineAirJamAgentStores({
              default: agentStore<{ speed: number }>(),
            }),
            projectSnapshot: ({ stores }) => stores.default ?? {},
            actions: {},
          }),
        },
      },
      { settings: { speed: 3, seats: 6 }, record: true },
    );
    const stop = runtime.start();
    try {
      await runtime.ready;
      await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
      const control = Reflect.get(
        environment.controlTarget,
        AIR_JAM_RUNTIME_CONTROL_KEY,
      ) as HostRuntimeControl;
      const snapshot = await control.agent({
        operation: "read",
        roomId: "ROOM1",
        controllerId: null,
      });
      if (snapshot.operation !== "read" || !snapshot.snapshot)
        throw new Error("Expected runtime");
      const target = {
        roomId: "ROOM1",
        runtimeId: snapshot.snapshot.runtimeId,
      };
      expect(
        await control.agent({ operation: "settings-read", ...target }),
      ).toMatchObject({ values: { speed: 3, seats: 6 }, revision: 0 });
      await expect(
        control.agent({
          operation: "settings-update",
          ...target,
          patch: { seats: 5 },
          expectedRevision: 0,
        }),
      ).rejects.toThrow("AJ_SETTING_NOT_LIVE");
      await expect(
        control.agent({
          operation: "settings-update",
          ...target,
          patch: { speed: 4 },
          expectedRevision: 1,
        }),
      ).rejects.toThrow("AJ_SETTING_STALE");
      await expect(
        control.agent({
          operation: "settings-update",
          ...target,
          runtimeId: "replaced",
          patch: { speed: 4 },
          expectedRevision: 0,
        }),
      ).rejects.toThrow("runtime_replaced");
      await expect(
        control.agent({
          operation: "settings-update",
          ...target,
          roomId: "OTHER",
          patch: { speed: 4 },
          expectedRevision: 0,
        }),
      ).rejects.toThrow();
      expect(
        await control.agent({
          operation: "settings-update",
          ...target,
          patch: { speed: 4 },
          expectedRevision: 0,
        }),
      ).toMatchObject({ values: { speed: 4, seats: 6 }, revision: 1 });
      await values.actions.read();
      runtime.simulation?.advance(10);
      const observed = await control.agent({
        operation: "observe",
        roomId: "ROOM1",
        controllerId: null,
        scope: "diagnostic",
        includeImage: false,
      });
      expect(observed).toMatchObject({
        observation: {
          runtime: { created: 3, stepped: 4, observed: 4 },
          snapshot: { speed: 4 },
        },
      });
      expect(runtime.inputLog().entries.map(({ event }) => event)).toEqual([
        "airjam:settings",
        "airjam:action_rpc",
      ]);
    } finally {
      stop();
    }
  });

  it("loads a simulation declared as a loader before stepping it", async () => {
    const socket = createServerSocket();
    const { environment } = createMemoryEnvironment(socket);
    let release: () => void = () => {};
    const loaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    const walker = defineAirJamSimulation<{ x: number }>({
      stepMs: 10,
      create: () => ({ x: 0 }),
      step: (sim) => {
        sim.x += 1;
      },
      observe: (sim) => ({ x: sim.x }),
    });
    const runtime = new HostRuntime({
      config,
      store: createConnectionStore(),
      getSocket: () => {
        throw new Error("The memory transport needs no socket.");
      },
      disconnectSocket: () => {},
      environment,
      stores: [createScoreStore()],
      simulation: () => loaded.then(() => walker),
      agent: {
        gameId: "walker",
        contract: defineAirJamAgentContract({
          stores: defineAirJamAgentStores({
            default: agentStore<{ score: number }>(),
          }),
          projectSnapshot: () => ({}),
          actions: {},
        }),
      },
    });
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    expect(runtime.simulation).toBeNull();

    release();
    await runtime.ready;
    runtime.simulation?.advance(30);
    const control = Reflect.get(
      environment.controlTarget,
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
      runtime: { x: 3 },
      ticks: { after: 3 },
    });
    stop();
  });
});

it.each(["frame", "step"])(
  "retains a %s exception once, stops frames and exposes it to agents",
  async (lane) => {
    const socket = createServerSocket();
    const { environment } = createMemoryEnvironment(socket);
    let frame: (now: number) => void = () => {};
    const cancel = vi.fn();
    const framed: AirJamHostEnvironment = {
      ...environment,
      frames: (callback) => {
        frame = callback;
        return cancel;
      },
    };
    const emit = vi.spyOn(framed, "emitDevEvent");
    const error = new TypeError("radius must be non-negative");
    error.stack =
      "TypeError: radius must be non-negative\n    at sdk (http://localhost/packages/sdk/dist/core.js:1:2)\n    at draw (http://localhost/src/combat/arena-paint.ts?t=12:42:7)\n    at vendor (http://localhost/node_modules/render.js:4:5)";
    const fail = vi.fn(() => {
      throw error;
    });
    const scores = createScoreStore();
    const store = createConnectionStore();
    const runtime = new HostRuntime({
      config,
      store,
      getSocket: () => {
        throw new Error("The memory transport needs no socket.");
      },
      disconnectSocket: () => {},
      environment: framed,
      stores: [scores],
      simulation: defineAirJamSimulation({
        stepMs: 10,
        create: () => ({}),
        step: lane === "step" ? fail : () => {},
        observe: () => ({}),
      }),
      agent: {
        gameId: "walker",
        contract: defineAirJamAgentContract({
          stores: defineAirJamAgentStores({
            default: agentStore<{ score: number }>(),
          }),
          projectSnapshot: () => ({}),
          actions: {},
        }),
      },
    });
    const stop = runtime.start();
    try {
      await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
      store.getState().setRuntimeState("playing");
      if (lane === "frame") runtime.simulation!.onFrame(fail);
      expect(runtime.fault).toBeNull();
      expect(() => {
        frame(0);
        frame(20);
        frame(40);
      }).not.toThrow();
      const tick = runtime.simulation!.ticks;
      frame(60);
      expect(runtime.simulation!.ticks).toBe(tick);
      expect(fail).toHaveBeenCalledOnce();
      expect(cancel).toHaveBeenCalledOnce();
      expect(runtime.fault).toEqual({
        name: "TypeError",
        message: error.message,
        stack: error.stack,
        source: { file: "src/combat/arena-paint.ts", line: 42, column: 7 },
      });
      const faults = emit.mock.calls
        .map(([event]) => event)
        .filter((event) => event.level === "error");
      expect(faults).toEqual([
        expect.objectContaining({
          event: "runtime.host.frame_fault",
          level: "error",
          role: "host",
          roomId: "ROOM1",
          message:
            "TypeError: radius must be non-negative at src/combat/arena-paint.ts:42:7",
          data: { fault: runtime.fault },
        }),
      ]);
      const control = Reflect.get(
        environment.controlTarget,
        AIR_JAM_RUNTIME_CONTROL_KEY,
      ) as HostRuntimeControl;
      const response = await control.agent({
        operation: "observe",
        roomId: "ROOM1",
        controllerId: null,
        scope: "diagnostic",
        includeImage: false,
      });
      if (response.operation !== "observe") throw new Error("Expected observe");
      expect(
        hostObservationSchema.parse(response.observation).host?.after?.fault,
      ).toEqual(runtime.fault);
    } finally {
      stop();
    }
  },
);
