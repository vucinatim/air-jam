import { z } from "zod";

/** Room events a host receives that change what its simulation reads. */
export const AIR_JAM_INPUT_LOG_EVENTS = [
  "server:controllerJoined",
  "server:controllerLeft",
  "server:playerUpdated",
  "server:state",
  "server:input",
  "airjam:action_rpc",
] as const;

const inputLogEntrySchema = z
  .object({
    /** The step the event reached the game before. */
    tick: z.number().int().positive(),
    event: z.enum(AIR_JAM_INPUT_LOG_EVENTS),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

/**
 * Everything that reached a host's game from outside, by simulation step:
 * players joining and leaving, runtime state, store actions applied between
 * steps, and each seat's controls whenever they changed. Fed back to a host
 * with the same seed, it plays the same match.
 */
export const airJamInputLogSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(0).max(0xffff_ffff),
    stepMs: z.number().positive(),
    /** Steps the recorded host took. */
    ticks: z.number().int().nonnegative(),
    /** The store domain of stores that declare none, so actions find their store again. */
    storeDomain: z.string().min(1),
    entries: z.array(inputLogEntrySchema),
  })
  .strict();

export type AirJamInputLog = z.infer<typeof airJamInputLogSchema>;
export type AirJamInputLogEntry = AirJamInputLog["entries"][number];
export type AirJamInputLogEvent = AirJamInputLogEntry["event"];

/** Collects a host's input log while it runs. */
export class InputRecorder {
  private readonly entries: AirJamInputLogEntry[] = [];
  private pending: Omit<AirJamInputLogEntry, "tick">[] = [];

  /** Notes an event that arrived between steps; it takes the next step's tick. */
  record(event: AirJamInputLogEvent, payload: object): void {
    this.pending.push({
      event,
      payload: structuredClone(payload) as Record<string, unknown>,
    });
  }

  /** Stamps pending events with the step about to run, then adds `entries`. */
  flush(
    tick: number,
    entries: readonly Omit<AirJamInputLogEntry, "tick">[] = [],
  ): void {
    for (const entry of [...this.pending, ...entries])
      this.entries.push({ tick, ...entry });
    this.pending = [];
  }

  log({
    seed,
    stepMs,
    ticks,
    storeDomain,
  }: Omit<AirJamInputLog, "version" | "entries">): AirJamInputLog {
    return {
      version: 1,
      seed,
      stepMs,
      ticks,
      storeDomain,
      entries: [...this.entries],
    };
  }
}
