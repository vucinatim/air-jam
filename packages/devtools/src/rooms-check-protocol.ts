import { z } from "zod";

/**
 * The messages between `airjam rooms check` and its device processes. Each
 * edge-case device (one host or one phone) runs in its own process, so the
 * check can freeze it as a locked phone is frozen, kill it as a closed tab
 * is, and start a replacement; load runs whole rooms in a few workers.
 */
const keySchema = z.string().min(16).max(128);
const codeSchema = z.string().min(4).max(8);

/** How every device reaches the room server. */
const linkSchema = z.object({
  url: z.string(),
  /** The Origin header each connection sends. */
  origin: z.string().optional(),
});
export type DeviceLink = z.infer<typeof linkSchema>;

/** A shell command whose trimmed output is one fresh host credential. */
const credentialCommandSchema = z.string().min(1).optional();

export const deviceCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("host"),
    link: linkSchema,
    key: keySchema,
    code: codeSchema.optional(),
    /** A host resuming its instance asks for no credential. */
    instance: z.string().optional(),
    credentialCommand: credentialCommandSchema,
    seats: z.number().int().min(1).max(16),
    statesPerSecond: z.number().nonnegative(),
    /** False sends no client pings, as a hidden tab's throttled timers do. */
    heartbeat: z.boolean(),
  }),
  z.object({
    type: z.literal("phone"),
    link: linkSchema,
    key: keySchema,
    code: codeSchema,
    instance: z.string().optional(),
    inputsPerSecond: z.number().nonnegative(),
  }),
  /** An idle phone taps once. */
  z.object({ type: z.literal("press") }),
  /** The connection the device asked to open with `dial` may open now. */
  z.object({ type: z.literal("dial"), id: z.number().int() }),
  z.object({
    type: z.literal("load"),
    link: linkSchema,
    credentialCommand: credentialCommandSchema,
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

export const linkProblemSchema = z.discriminatedUnion("kind", [
  /** The server answered the upgrade with this HTTP status instead of a socket. */
  z.object({ kind: z.literal("refused"), status: z.number() }),
  /** No answer: the network or TLS error, or the handshake timing out. */
  z.object({ kind: z.literal("failed"), error: z.string() }),
  /** An open connection closed without the device asking, with the room's reason when the code has one. */
  z.object({
    kind: z.literal("closed"),
    code: z.number(),
    reason: z.string().nullable(),
  }),
]);
export type LinkProblem = z.infer<typeof linkProblemSchema>;

export const describeLinkProblem = (problem: LinkProblem): string => {
  switch (problem.kind) {
    case "refused":
      return `refused with HTTP ${problem.status}`;
    case "failed":
      return `failed to open: ${problem.error}`;
    case "closed":
      return `closed with ${problem.code}${problem.reason ? ` (${problem.reason})` : ""}`;
  }
};

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
  /** Asks for a grant to open a connection; the check paces opens across devices. */
  z.object({ type: z.literal("dial"), at: z.number(), id: z.number().int() }),
  /** A connection began opening. */
  z.object({ type: z.literal("dialing"), at: z.number() }),
  z.object({
    type: z.literal("problem"),
    at: z.number(),
    problem: linkProblemSchema,
  }),
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
  /** Every connection that failed to open or closed without its device asking, expected or not. */
  readonly connectionProblems: readonly ConnectionProblem[];
}

export interface ConnectionProblem {
  readonly device: string;
  /** Since the scenario began. */
  readonly atMs: number;
  readonly problem: LinkProblem;
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
