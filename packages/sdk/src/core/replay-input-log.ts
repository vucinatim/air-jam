import { z } from "zod";
import {
  DEFAULT_ROOM_LIMITS,
  runtimeStateSchema,
  seatViewSchema,
  type SeatId,
  type SeatView,
} from "../room-protocol";
import type {
  HostRoom,
  HostSessionEvents,
} from "../room-session/host-room-session";
import { Listeners } from "../room-session/listeners";
import { resolveRuntimeTopology } from "../runtime-topology";
import {
  AIR_JAM_RUNTIME_CONTROL_KEY,
  type HostRuntimeControl,
} from "../runtime/contracts/control";
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
const seatLogEventSchema = z.object({ seat: seatViewSchema });
const leftLogEventSchema = z.object({ seat: z.string() });
const inputLogEventSchema = z.object({
  seat: z.string(),
  input: z.record(z.string(), z.unknown()),
});
const runtimeLogEventSchema = z.object({ runtimeState: runtimeStateSchema });
const actionLogEventSchema = z.object({
  actionName: z.string(),
  payload: z.unknown().optional(),
  storeDomain: z.string(),
  actor: z.object({
    id: z.string(),
    role: z.enum(["host", "controller"]),
  }),
});

const REPLAY_ROOM_ID = "REPLAY";
const REPLAY_ORIGIN = "http://replay.invalid";

/**
 * A room with no server: it is open from the start, and delivers only the
 * seats and input the replay fires, exactly when it fires them.
 */
const createReplayRoom = () => {
  const events = new Listeners<HostSessionEvents>();
  const seats = new Map<SeatId, SeatView>();
  const emitSeats = () => events.emit("seats", [...seats.values()]);
  const room: HostRoom = {
    on: events.on.bind(events),
    status: { phase: "open" },
    code: REPLAY_ROOM_ID,
    instance: "replay",
    get seats() {
      return [...seats.values()];
    },
    limits: DEFAULT_ROOM_LIMITS,
    room: {
      seatsWanted: DEFAULT_ROOM_LIMITS.seats,
      locked: false,
      activity: null,
      features: [],
    },
    roomCopies: [],
    channels: () => [],
    publish: () => {},
    drop: () => {},
    respond: () => {},
    signal: () => {},
    configure: () => {},
    remove: () => {},
    // The game's colours replay as it set them.
    setColor: (seat, color) => {
      const view = seats.get(seat);
      if (!view) return;
      seats.set(seat, { ...view, color });
      emitSeats();
    },
    setActivity: () => {},
    end: () => {},
    close: () => {},
  };
  return {
    room,
    seat: (seat: SeatView) => {
      seats.set(seat.id, seat);
      emitSeats();
    },
    left: (seat: SeatId) => {
      seats.delete(seat);
      emitSeats();
    },
    input: (seat: SeatId, state: Record<string, unknown>) =>
      events.emit("input", { seat, state: state as never }),
  };
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
  const replayRoom = createReplayRoom();
  const store = createConnectionStore();
  let runtime: HostRuntime | null = null;
  const controlTarget = {};
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: log.storeDomain,
    presentationChannel: "airjam.room",
    controlTarget,
    openRoom: () => replayRoom.room,
    createKey: () => "replay",
    readResume: () => null,
    writeResume: () => {},
    requestHostGrant: () =>
      Promise.reject(new Error("A replay runs without host grants.")),
    controllerUrls: async (roomId) => ({
      joinUrl: `${REPLAY_ORIGIN}/controller?room=${roomId}`,
      localControllerUrl: `${REPLAY_ORIGIN}/controller?room=${roomId}`,
    }),
    reportError: () => {},
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
      environment,
    },
    { seed: log.seed, settings: log.settings },
  );
  const stop = runtime.start();
  try {
    await runtime.ready;
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
        switch (event) {
          case "seat":
            replayRoom.seat(seatLogEventSchema.parse(payload).seat);
            break;
          case "left":
            replayRoom.left(leftLogEventSchema.parse(payload).seat);
            break;
          case "input": {
            const entry = inputLogEventSchema.parse(payload);
            replayRoom.input(entry.seat, entry.input);
            break;
          }
          case "runtime":
            runtime.setRuntimeState(
              runtimeLogEventSchema.parse(payload).runtimeState,
            );
            break;
          case "action": {
            // A logged action without a payload had none when it ran.
            const action = actionLogEventSchema.parse(payload);
            runtime.replayAction({ ...action, payload: action.payload });
            break;
          }
          case "settings": {
            const accepted = settingsLogEventSchema.parse(payload);
            runtime.updateSettings(accepted.patch, accepted.revision - 1);
            break;
          }
        }
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
