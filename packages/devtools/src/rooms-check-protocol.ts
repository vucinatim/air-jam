import { z } from "zod";

/**
 * The messages between `airjam rooms check` and its device processes. Each
 * edge-case device (one host or one phone) runs in its own process, so the
 * check can freeze it as a locked phone is frozen, kill it as a closed tab
 * is, and start a replacement; load runs whole rooms in a few workers.
 */
const keySchema = z.string().min(16).max(128);
const codeSchema = z.string().min(4).max(8);

export const deviceCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("host"),
    url: z.string(),
    key: keySchema,
    code: codeSchema.optional(),
    instance: z.string().optional(),
    seats: z.number().int().min(1).max(16),
    statesPerSecond: z.number().nonnegative(),
    /** False sends no client pings, as a hidden tab's throttled timers do. */
    heartbeat: z.boolean(),
  }),
  z.object({
    type: z.literal("phone"),
    url: z.string(),
    key: keySchema,
    code: codeSchema,
    instance: z.string().optional(),
    inputsPerSecond: z.number().nonnegative(),
  }),
  /** An idle phone taps once. */
  z.object({ type: z.literal("press") }),
  z.object({
    type: z.literal("load"),
    url: z.string(),
    rooms: z.number().int().positive(),
    phonesPerRoom: z.number().int().min(1).max(16),
    inputsPerSecond: z.number().positive(),
    statesPerSecond: z.number().nonnegative(),
    durationMs: z.number().int().positive(),
  }),
]);
export type DeviceCommand = z.infer<typeof deviceCommandSchema>;

const statusSchema = z.object({
  phase: z.enum(["connecting", "waiting", "open", "reconnecting", "closed"]),
  reason: z.string().optional(),
});

export const latencySummarySchema = z.object({
  count: z.number(),
  medianMs: z.number().nullable(),
  p99Ms: z.number().nullable(),
  maximumMs: z.number().nullable(),
});
export type LatencySummary = z.infer<typeof latencySummarySchema>;

const trafficSchema = z.object({
  /** Messages and payload bytes the devices sent to the room server. */
  messagesIn: z.number(),
  bytesIn: z.number(),
  /** Messages and payload bytes the room server sent to the devices. */
  messagesOut: z.number(),
  bytesOut: z.number(),
});
export type RoomTraffic = z.infer<typeof trafficSchema>;

export const loadResultSchema = z.object({
  roomsOpened: z.number(),
  phonesJoined: z.number(),
  roomOpenMs: z.array(z.number()),
  phoneJoinMs: z.array(z.number()),
  /** Tap to host, per press, measured within the worker on one clock. */
  inputLatencyMs: z.array(z.number()),
  pressesSent: z.number(),
  pressesLost: z.number(),
  stateLatencyMs: z.array(z.number()),
  traffic: trafficSchema,
  cpuMs: z.number(),
});
export type LoadResult = z.infer<typeof loadResultSchema>;

/** Everything a device reports, each stamped with the shared wall clock. */
export const deviceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("status"),
    at: z.number(),
    status: statusSchema,
    code: z.string().optional(),
    instance: z.string().optional(),
    seat: z.string().optional(),
    hostGraceMs: z.number().optional(),
  }),
  z.object({
    type: z.literal("seats"),
    at: z.number(),
    seats: z.array(z.object({ id: z.string(), connected: z.boolean() })),
  }),
  z.object({ type: z.literal("host"), at: z.number(), present: z.boolean() }),
  /** A phone pressed: its button's press count went up to `presses`. */
  z.object({ type: z.literal("pressed"), at: z.number(), presses: z.number() }),
  /** A host saw a seat's press count reach `presses`. */
  z.object({
    type: z.literal("received"),
    at: z.number(),
    seat: z.string(),
    presses: z.number(),
  }),
  z.object({ type: z.literal("published"), at: z.number(), tick: z.number() }),
  z.object({ type: z.literal("state"), at: z.number(), tick: z.number() }),
  z.object({
    type: z.literal("load"),
    at: z.number(),
    result: loadResultSchema,
  }),
  z.object({ type: z.literal("failed"), at: z.number(), message: z.string() }),
]);
export type DeviceEvent = z.infer<typeof deviceEventSchema>;

export const ROOMS_CHECK_SCENARIOS = [
  "join",
  "phone-brief-freeze",
  "phone-long-freeze",
  "network-switch",
  "duplicate-join",
  "host-reload",
  "host-gone",
  "background-host",
  "crowd",
  "load",
] as const;
export type RoomsCheckScenario = (typeof ROOMS_CHECK_SCENARIOS)[number];

/** Every scenario but load, which is heavy enough to be asked for by name. */
export const DEFAULT_ROOMS_CHECK_SCENARIOS = ROOMS_CHECK_SCENARIOS.filter(
  (scenario) => scenario !== "load",
);

export interface RoomsCheckScenarioResult {
  readonly scenario: RoomsCheckScenario;
  readonly passed: boolean;
  /** Why it failed, in one sentence. */
  readonly failure?: string;
  readonly durationMs: number;
  /** What it measured, in milliseconds unless the name says otherwise. */
  readonly measurements: Readonly<Record<string, unknown>>;
}

export interface RoomsCheckReport {
  readonly url: string;
  readonly passed: boolean;
  readonly scenarios: readonly RoomsCheckScenarioResult[];
}

/** The wall clock every device process shares, with sub-millisecond precision. */
export const sharedNow = (): number =>
  performance.timeOrigin + performance.now();

export const summarizeLatency = (
  samples: readonly number[],
): LatencySummary => {
  if (samples.length === 0)
    return { count: 0, medianMs: null, p99Ms: null, maximumMs: null };
  const sorted = [...samples].sort((left, right) => left - right);
  const at = (fraction: number) =>
    round(
      sorted[
        Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))
      ] ?? 0,
    );
  return {
    count: sorted.length,
    medianMs: at(0.5),
    p99Ms: at(0.99),
    maximumMs: round(sorted.at(-1) ?? 0),
  };
};

const round = (value: number) => Math.round(value * 100) / 100;
