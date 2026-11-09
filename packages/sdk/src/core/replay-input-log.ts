import { z } from "zod";
import type { HostBootstrapAck, HostRegistrationAck } from "../protocol";
import { resolveRuntimeTopology } from "../runtime-topology";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../runtime/contracts/control";
import type {
  AirJamRealtimeClient,
  BridgeListener,
} from "../runtime/realtime-client";
import { createAirJamConfig } from "./config";
import { createConnectionStore } from "./connection-store";
import type { AirJamHostEnvironment } from "./environment";
import type { HostRuntime, HostRuntimeFactory } from "./host-runtime";
import { airJamInputLogSchema, type AirJamInputLog } from "./input-log";
import { airJamSettingsValuesSchema } from "./settings";
const settingsLogEventSchema = z
  .object({
    patch: airJamSettingsValuesSchema,
    revision: z.number().int().positive(),
  })
  .strict();

const REPLAY_ROOM_ID = "REPLAY";
const REPLAY_ORIGIN = "http://replay.invalid";
const ROOM_OPEN_TIMEOUT_MS = 5_000;

/**
 * A room with no server: it admits the host, then delivers only the events
 * the replay fires, exactly when it fires them.
 */
const createReplayRoom = () => {
  const listeners = new Map<string, Set<BridgeListener>>();
  const fire = (event: string, payload?: unknown): void => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  const answer = (event: string): unknown => {
    if (event === "host:bootstrap")
      return { ok: true } satisfies HostBootstrapAck;
    if (event === "host:createRoom")
      return {
        ok: true,
        roomId: REPLAY_ROOM_ID,
        players: [],
        controllers: [],
      } satisfies HostRegistrationAck;
    return undefined;
  };
  let connected = false;
  const client: AirJamRealtimeClient & { fire: typeof fire } = {
    get connected() {
      return connected;
    },
    get active() {
      return connected;
    },
    id: "replay",
    connect() {
      connected = true;
      fire("connect");
      return client;
    },
    disconnect() {
      connected = false;
      fire("disconnect", "io client disconnect");
      return client;
    },
    on(event, listener) {
      listeners.set(event, (listeners.get(event) ?? new Set()).add(listener));
      return client;
    },
    off(event, listener) {
      if (listener) listeners.get(event)?.delete(listener);
      else listeners.delete(event);
      return client;
    },
    emit(event, ...args) {
      const acknowledge = args.at(-1);
      if (typeof acknowledge === "function") acknowledge(answer(event));
      return client;
    },
    emitWithAck: async <TAck>(event: string) => answer(event) as TAck,
    fire,
  };
  return client;
};

export interface AirJamReplay {
  runtime: HostRuntime;
  roomId: string;
  agent: HostRuntimeControl["agent"];
  stop: () => void;
  stepMs: number;
  /** Total recorded steps. */
  ticks: number;
  readonly tick: number;
  readonly done: boolean;
  advance(by: { steps: number } | { ms: number }): number;
}

/**
 * Opens a recorded match paused on a fresh host of the same game source.
 * Advance in whole steps or game milliseconds (fractions carry between calls).
 * Reaching the end applies trailing events once. To go back, open a new replay
 * on a fresh load of the game: its stores are module singletons, so it cannot
 * share a game module with a live host or another replay.
 */
export const openAirJamReplay = async (
  createHostRuntime: HostRuntimeFactory,
  recorded: AirJamInputLog,
): Promise<AirJamReplay> => {
  const log = airJamInputLogSchema.parse(recorded);
  const room = createReplayRoom();
  const store = createConnectionStore();
  let runtime: HostRuntime | null = null;
  const controlTarget = {};
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: log.storeDomain,
    controlTarget,
    readResume: () => null,
    writeResume: () => {},
    requestHostGrant: () =>
      Promise.reject(new Error("A replay runs without host grants.")),
    controllerUrl: async (roomId) =>
      `${REPLAY_ORIGIN}/controller?room=${roomId}`,
    transport: () => room,
    emitDevEvent: () => {},
    setDevLogContext: () => {},
    seed: () => log.seed,
    now: () => runtime?.simulation?.timeMs ?? 0,
  };
  runtime = createHostRuntime(
    {
      config: createAirJamConfig({
        topology: resolveRuntimeTopology({
          runtimeMode: "self-hosted-production",
          surfaceRole: "host",
          appOrigin: REPLAY_ORIGIN,
          backendOrigin: REPLAY_ORIGIN,
          socketOrigin: REPLAY_ORIGIN,
          publicHost: REPLAY_ORIGIN,
          embedded: false,
          proxyStrategy: "none",
          secureTransport: false,
        }),
      }),
      store,
      getSocket: () => {
        throw new Error("A replay room needs no socket.");
      },
      disconnectSocket: () => {},
      environment,
    },
    { seed: log.seed, settings: log.settings },
  );
  const stop = runtime.start();
  try {
    await runtime.ready;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error("The replay host never opened its room."));
      }, ROOM_OPEN_TIMEOUT_MS);
      const check = () => {
        if (store.getState().registeredRoomId !== REPLAY_ROOM_ID) return;
        clearTimeout(timer);
        unsubscribe();
        resolve();
      };
      const unsubscribe = store.subscribe(check);
      check();
    });
    const clock = runtime.simulation;
    if (!clock) throw new Error("A replay needs the game's simulation.");
    if (clock.ticks !== 0 || clock.stepMs !== log.stepMs)
      throw new Error("The replayed game does not match the recorded one.");
    let next = 0;
    let tick = 0;
    let remainderMs = 0;
    let trailingApplied = false;
    const fireEntries = (at: number) => {
      for (; log.entries[next]?.tick === at; next += 1) {
        const { event, payload } = log.entries[next];
        if (event === "airjam:settings") {
          const accepted = settingsLogEventSchema.parse(payload);
          runtime.updateSettings(accepted.patch, accepted.revision - 1);
          continue;
        }
        room.fire(
          event,
          "roomId" in payload
            ? { ...payload, roomId: REPLAY_ROOM_ID }
            : payload,
        );
      }
    };
    const finish = () => {
      if (tick !== log.ticks || trailingApplied) return;
      fireEntries(log.ticks + 1);
      trailingApplied = true;
    };
    finish();
    return {
      runtime,
      roomId: REPLAY_ROOM_ID,
      agent: (request) => {
        const control = Reflect.get(
          controlTarget,
          AIR_JAM_RUNTIME_CONTROL_KEY,
        ) as HostRuntimeControl | undefined;
        if (!control)
          throw new Error(
            "The replayed game publishes nothing agents can read.",
          );
        return control.agent(request);
      },
      stop,
      stepMs: log.stepMs,
      ticks: log.ticks,
      get tick() {
        return tick;
      },
      get done() {
        return trailingApplied;
      },
      advance(by) {
        const amount = "steps" in by ? by.steps : by.ms;
        if (
          !Number.isFinite(amount) ||
          amount < 0 ||
          ("steps" in by && !Number.isInteger(amount))
        )
          throw new Error(
            "Replay advance needs nonnegative whole steps or finite milliseconds.",
          );
        let steps: number;
        if ("ms" in by) {
          remainderMs += by.ms;
          steps = Math.floor(remainderMs / log.stepMs);
          remainderMs -= steps * log.stepMs;
        } else steps = by.steps;
        const end = tick + Math.min(steps, log.ticks - tick);
        clock.batch(() => {
          while (tick < end) {
            fireEntries(tick + 1);
            clock.advance(log.stepMs);
            tick += 1;
          }
          finish();
        });
        return tick;
      },
    };
  } catch (error) {
    stop();
    throw error;
  }
};

/** Plays a recorded match to completion; stop the returned host when finished. */
export const replayAirJamInputLog = async (
  createHostRuntime: HostRuntimeFactory,
  recorded: AirJamInputLog,
): Promise<Pick<AirJamReplay, "runtime" | "roomId" | "agent" | "stop">> => {
  const replay = await openAirJamReplay(createHostRuntime, recorded);
  try {
    replay.advance({ steps: replay.ticks });
    return {
      runtime: replay.runtime,
      roomId: replay.roomId,
      agent: replay.agent,
      stop: replay.stop,
    };
  } catch (error) {
    replay.stop();
    throw error;
  }
};
