// Runs in plain Node: the core host runtime needs no React and no DOM.
import { describe, expect, it, vi } from "vitest";
import {
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "../src/agent/agent-contract";
import {
  createConnectionStore,
  getReconnectingPlayerIds,
} from "../src/core/connection-store";
import { type AirJamHostEnvironment } from "../src/core/environment";
import { defineAirJamGame } from "../src/core/game";
import { HostRuntime } from "../src/core/host-runtime";
import {
  axis,
  defineAirJamInput,
  type AirJamInputValues,
} from "../src/core/input";
import { replayAirJamInputLog } from "../src/core/replay-input-log";
import {
  createAirJamStore,
  type AirJamActionContext,
} from "../src/core/replicated-store";
import {
  defineAirJamSettings,
  setting,
  type AirJamSettingsValues,
} from "../src/core/settings";
import { defineAirJamSimulation } from "../src/core/simulation";
import { onAirJamDiagnostic } from "../src/diagnostics";
import { defineAirJamGameMetadata } from "../src/metadata/manifest";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../src/runtime/contracts/control";
import { hostObservationSchema } from "../src/runtime/contracts/observation";
import { createMemoryEnvironment } from "./fixtures/host-environment";

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
    const { environment, memory, readStoredResume } = createMemoryEnvironment();
    const store = createConnectionStore();
    const joined = vi.fn();
    const scores = createScoreStore();
    const game = defineAirJamGame({
      metadata: defineAirJamGameMetadata({
        slug: "joystick-game",
        name: "Joystick game",
        tagline: "Fixture",
        category: "arcade",
        minPlayers: 1,
        maxPlayers: 4,
        inputModalities: ["joystick"],
        supportedSdkRange: "^1.0.0",
        maintainer: { name: "Air Jam" },
      }),
      stores: [scores],
    });
    const runtime = game.createHostRuntime(
      {
        config,
        store,
        environment,
      },
      { onPlayerJoin: joined },
    );

    const stop = runtime.start();
    await vi.waitFor(() =>
      expect(store.getState().connectionStatus).toBe("connected"),
    );
    expect(runtime.roomId).toBe("ROOM1");
    expect(store.getState().controllerOrientation).toBe("landscape");
    expect(memory.published.get("airjam.room")?.document).toEqual({
      runtimeState: "playing",
      orientation: "landscape",
    });
    expect(readStoredResume()).toEqual({
      key: "host-key-00000001",
      code: "ROOM1",
      instance: "instance-1",
    });
    await vi.waitFor(() =>
      expect(store.getState()).toMatchObject({
        joinUrl: "https://play.test/controller?room=ROOM1",
        joinUrlStatus: "ready",
      }),
    );

    memory.seat({ id: "p1", label: "One" });
    const player = store.getState().players[0];
    expect(player).toMatchObject({ id: "p1", label: "One", connected: true });
    await vi.waitFor(() => expect(joined).toHaveBeenCalledWith(player));

    // A phone asks to pause; the host owns the presentation and publishes it.
    expect(memory.request("p1", "airjam.room", "pause")).toEqual({
      runtimeState: "paused",
    });
    expect(memory.published.get("airjam.room")?.document).toEqual({
      runtimeState: "paused",
      orientation: "landscape",
    });

    // The store syncs with the room although no component reads it.
    expect(scores.attached).toBe(true);
    await scores.actions.score({ by: 2 });
    expect(memory.published.get("default")?.document).toEqual({ score: 2 });

    stop();
    expect(scores.attached).toBe(false);
    expect(memory.room.status).toEqual({ phase: "closed", reason: "owner" });
  });

  it("reports a room that refuses the host to the developer and the page", async () => {
    const { environment, memory } = createMemoryEnvironment();
    const store = createConnectionStore();
    const diagnostics = vi.fn();
    const stopListening = onAirJamDiagnostic(diagnostics);
    const runtime = new HostRuntime({ config, store, environment, stores: [] });
    const stop = runtime.start();
    try {
      await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
      memory.setStatus({ phase: "closed", reason: "unauthorised" });
      expect(diagnostics).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "AJ_HOST_BOOTSTRAP_FAILED",
          details: { reason: "unauthorised", roomId: "ROOM1" },
        }),
      );
      expect(store.getState()).toMatchObject({
        connectionStatus: "disconnected",
        lastError: "The room closed the connection: unauthorised.",
      });
    } finally {
      stop();
      stopListening();
    }
  });

  it("reopens a vanished room standalone, but stops embedded and leaves replacement to its parent", async () => {
    for (const embedded of [null, { joinUrl: "https://play.test/join" }]) {
      const { environment, memory } = createMemoryEnvironment();
      const openRoom = vi.fn(environment.openRoom);
      const runtime = new HostRuntime({
        config,
        store: createConnectionStore(),
        environment: { ...environment, embedded, openRoom },
        stores: [],
      });
      const stop = runtime.start();
      await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
      memory.setStatus({ phase: "closed", reason: "closed" });
      expect(openRoom).toHaveBeenCalledTimes(embedded ? 1 : 2);
      stop();
    }
  });

  it("ends its room and opens a fresh one on reset, forgetting the old room's place", async () => {
    const { environment, memory, readStoredResume } = createMemoryEnvironment();
    const openRoom = vi.fn(environment.openRoom);
    const end = vi.spyOn(memory.room, "end");
    const store = createConnectionStore();
    const left = vi.fn();
    const runtime = new HostRuntime(
      { config, store, environment: { ...environment, openRoom }, stores: [] },
      { onPlayerLeave: left },
    );
    const stop = runtime.start();
    try {
      await vi.waitFor(() => expect(readStoredResume()).not.toBeNull());
      memory.seat({ id: "p1", label: "One" });
      runtime.resetRoom();
      expect(end).toHaveBeenCalledOnce();
      expect(openRoom).toHaveBeenCalledTimes(2);
      expect(openRoom.mock.lastCall?.[0].instance).toBeUndefined();
      expect(store.getState().players).toEqual([]);
      expect(left).toHaveBeenCalledWith("p1");
    } finally {
      stop();
    }
  });

  it("tells the game at once that a phone dropped, and again when it is back", async () => {
    const { environment, memory } = createMemoryEnvironment();
    const store = createConnectionStore();
    const seen: string[][] = [];
    const runtime = new HostRuntime(
      {
        config,
        store,
        environment,
        stores: [],
        simulation: defineAirJamSimulation({
          stepMs: 10,
          create: () => ({}),
          step: (_sim, { reconnectingPlayerIds }) => {
            seen.push([...reconnectingPlayerIds]);
          },
        }),
      },
      { seed: 1 },
    );
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    const reconnecting = () =>
      getReconnectingPlayerIds(store.getState().players);
    memory.seat({ id: "p1", label: "One" });
    runtime.simulation?.advance(10);

    memory.seat({ id: "p1", label: "One", connected: false });
    expect(store.getState().players).toEqual([
      expect.objectContaining({ id: "p1", connected: false }),
    ]);
    expect(reconnecting()).toEqual(["p1"]);
    runtime.simulation?.advance(10);

    memory.seat({ id: "p1", label: "One" });
    expect(reconnecting()).toEqual([]);
    runtime.simulation?.advance(10);

    expect(seen).toEqual([[], ["p1"], []]);
    expect(
      runtime.inputLog().entries.map((entry) => [entry.tick, entry.event]),
    ).toEqual([
      [1, "seat"],
      [2, "seat"],
      [3, "seat"],
    ]);
    stop();
  });

  it("publishes the agent contract and the simulation's declared view on the host clock", async () => {
    const { environment, memory } = createMemoryEnvironment();
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
        sim.x += input("p1").direction;
      },
      observe: (sim) => ({ x: sim.x }),
    });
    const runtime = new HostRuntime({
      config,
      store: createConnectionStore(),
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
          projectSnapshot: ({ stores, players }) => ({
            score: stores.default?.score ?? null,
            players,
          }),
          actions: {},
        }),
      },
    });
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    memory.seat({ id: "p1", label: "Walker" });
    const player = runtime.store.getState().players[0];
    memory.input("p1", { direction: 1 });
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
      snapshot: { score: 0, players: [player] },
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
      const { environment } = createMemoryEnvironment();
      const timed = createTimedStore();
      const runtime = new HostRuntime({
        config,
        store: createConnectionStore(),
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
          sim.x += input("p1").direction + random();
          sim.path.push(sim.x);
          // Outcomes a step causes replay with it rather than from the log.
          if (tick % 7 === 0) void scores.actions.score({ by: 1 });
        },
      });
      return { scores, walker };
    };
    const live = createGame();
    const { environment, memory } = createMemoryEnvironment();
    let gameMs = 0;
    const runtime = new HostRuntime(
      {
        config,
        store: createConnectionStore(),
        environment: { ...environment, now: () => gameMs },
        stores: [live.scores],
        simulation: live.walker,
        input: walkerInput,
      },
      { seed: 3 },
    );
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    const advance = (ms: number) => {
      gameMs += ms;
      runtime.simulation?.advance(ms);
    };
    memory.seat({ id: "p1", label: "One" });
    advance(30);
    memory.input("p1", { direction: 1 });
    advance(55);
    memory.request("p1", "default", "score", { by: 5 });
    advance(40);
    memory.input("p1", { direction: -0.5 });
    advance(100);
    const log = runtime.inputLog();
    const played = {
      path: [...(runtime.simulation?.sim as { path: number[] }).path],
      score: live.scores.getState().score,
    };
    stop();

    expect(log).toMatchObject({ seed: 3, stepMs: 10, ticks: 22 });
    expect(log.entries.map(({ tick, event }) => [tick, event])).toEqual([
      [1, "seat"],
      [4, "input"],
      [9, "action"],
      [13, "input"],
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
    const { environment } = createMemoryEnvironment();
    const runtime = new HostRuntime(
      {
        config,
        store: createConnectionStore(),
        environment,
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
      { settings: { speed: 3, seats: 6 } },
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
        "settings",
        "action",
      ]);
    } finally {
      stop();
    }
  });

  it("loads a simulation declared as a loader before stepping it", async () => {
    const { environment } = createMemoryEnvironment();
    let release: () => void = () => {};
    const loaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    const walker = defineAirJamSimulation<
      { x: number },
      unknown,
      { type: "round" }
    >({
      stepMs: 10,
      create: () => ({ x: 0 }),
      step: (sim, { emit }) => {
        sim.x += 1;
        if (sim.x === 3) emit({ type: "round" });
      },
      moment: () => "Round started",
      observe: (sim) => ({ x: sim.x }),
    });
    const runtime = new HostRuntime({
      config,
      store: createConnectionStore(),
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
    const timeline = await control.agent({
      operation: "timeline-read",
      roomId: "ROOM1",
    });
    expect(timeline).toMatchObject({
      operation: "timeline-read",
      timeline: {
        status: "available",
        stepMs: 10,
        entries: expect.arrayContaining([
          {
            id: "moment:1",
            kind: "moment",
            text: "Round started",
            tick: 3,
            at: expect.any(Number),
          },
        ]),
      },
    });
    expect(
      runtime
        .inputLog()
        .entries.every(
          (entry) =>
            !Reflect.has(entry, "at") && !Reflect.has(entry.payload, "moment"),
        ),
    ).toBe(true);
    stop();
  });

  it("refuses settings while a loaded simulation is pending, so its log replays from its real creation settings", async () => {
    const settings = defineAirJamSettings({
      speed: setting.number({ default: 1, min: 1, max: 4, live: true }),
    });
    type Values = AirJamSettingsValues<typeof settings>;
    const mover = defineAirJamSimulation<
      { initialSpeed: number; distance: number },
      Record<string, never>,
      never,
      Values
    >({
      stepMs: 10,
      create: ({ settings }) => ({ initialSpeed: settings.speed, distance: 0 }),
      step: (sim, { settings }) => {
        sim.distance += settings.speed;
      },
    });
    let release: () => void = () => {};
    const loaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { environment } = createMemoryEnvironment();
    const runtime = new HostRuntime({
      config,
      store: createConnectionStore(),
      environment,
      stores: [],
      settings,
      simulation: () => loaded.then(() => mover),
    });
    const stop = runtime.start();
    await vi.waitFor(() => expect(runtime.roomId).toBe("ROOM1"));
    expect(() => runtime.updateSettings({ speed: 2 }, 0)).toThrow(
      "AJ_SETTING_INVALID: Settings change once the game's simulation has loaded.",
    );

    release();
    await runtime.ready;
    runtime.updateSettings({ speed: 3 }, 0);
    runtime.simulation?.advance(10);
    const played = structuredClone(runtime.simulation?.sim);
    const log = runtime.inputLog();
    stop();
    expect(played).toEqual({ initialSpeed: 1, distance: 3 });

    const replayed = await replayAirJamInputLog(
      (dependencies, options) =>
        new HostRuntime(
          {
            ...dependencies,
            stores: [],
            settings,
            simulation: async () => mover,
          },
          options,
        ),
      JSON.parse(JSON.stringify(log)),
    );
    expect(replayed.runtime.simulation?.sim).toEqual(played);
    replayed.stop();
  });
});

it.each(["frame", "step"])(
  "retains a %s exception once, stops frames and exposes it to agents",
  async (lane) => {
    const { environment } = createMemoryEnvironment();
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

it("timestamps appended room facts while paused, including events received during simulation loading", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const { environment, memory } = createMemoryEnvironment();
  const simulation = defineAirJamSimulation({
    stepMs: 10,
    create: () => ({}),
    step: () => {},
  });
  let load!: () => void;
  const loading = new Promise<void>((resolve) => {
    load = resolve;
  });
  const runtime = new HostRuntime({
    config,
    store: createConnectionStore(),
    environment,
    stores: [createScoreStore()],
    simulation: () => loading.then(() => simulation),
    settings: defineAirJamSettings({
      ballSpeed: setting.number({
        default: 600,
        min: 100,
        max: 1000,
        live: true,
      }),
    }),
    agent: {
      gameId: "timeline",
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
    await vi.advanceTimersByTimeAsync(0);
    expect(runtime.roomId).toBe("ROOM1");
    vi.setSystemTime(500);
    memory.seat({ id: "p1", label: "Loading phone", kind: "preview" });
    vi.setSystemTime(1000);
    load();
    await runtime.ready;
    runtime.simulation!.advance(10);
    vi.setSystemTime(2000);
    runtime.pauseRuntime();
    vi.setSystemTime(5000);
    memory.seat({ id: "p2", label: "Phone", kind: "preview" });
    vi.setSystemTime(6000);
    runtime.updateSettings({ ballSpeed: 900 }, 0);
    vi.setSystemTime(9000);
    runtime.resumeRuntime();
    const control = Reflect.get(
      environment.controlTarget,
      AIR_JAM_RUNTIME_CONTROL_KEY,
    ) as HostRuntimeControl;
    const result = await control.agent({
      operation: "timeline-read",
      roomId: "ROOM1",
    });
    if (
      result.operation !== "timeline-read" ||
      result.timeline.status !== "available"
    )
      throw new Error("Expected timeline");
    expect(result.timeline.startedAt).toBe(1000);
    expect(
      result.timeline.entries
        .filter((entry) => entry.kind === "join" || entry.kind === "settings")
        .map(({ kind, at }) => ({ kind, at })),
    ).toEqual([
      { kind: "join", at: 500 },
      { kind: "join", at: 5000 },
      { kind: "settings", at: 6000 },
    ]);
    const recorded = runtime.inputLog();
    expect(recorded.version).toBe(3);
    expect(
      recorded.entries
        .filter(
          (entry) =>
            (entry.event === "seat" &&
              (entry.payload.seat as { id: string }).id === "p2") ||
            entry.event === "settings",
        )
        .map((entry) => entry.tick),
    ).toEqual([2, 2]);
    expect(recorded.entries.every((entry) => !Reflect.has(entry, "at"))).toBe(
      true,
    );
  } finally {
    stop();
    vi.useRealTimers();
  }
});
