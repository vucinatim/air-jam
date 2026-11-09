import { z } from "zod";
import { airJamSettingsValuesSchema } from "./settings";

/** Room events a host receives that change what its simulation reads. */
export const AIR_JAM_INPUT_LOG_EVENTS = [
  "server:controllerJoined",
  "server:controllerLeft",
  "server:controllerDisconnected",
  "server:playerUpdated",
  "server:state",
  "server:input",
  "airjam:action_rpc",
  "airjam:settings",
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
 * players joining, dropping and leaving, runtime state, store actions applied between
 * steps, and each seat's controls whenever they changed. Fed back to a host
 * with the same seed, it plays the same match.
 */
export const airJamInputLogSchema = z
  .object({
    version: z.literal(2),
    settings: airJamSettingsValuesSchema,
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

/** Maximum played game time retained from the start of a match. */
export const AIR_JAM_INPUT_LOG_MAX_GAME_MS = 30 * 60 * 1000;
/** Sum of JSON lengths of entries, without serializing the whole log per step. */
export const AIR_JAM_INPUT_LOG_MAX_ENTRY_BYTES = 16 * 1024 * 1024;

/** A stable prefix, including any events pending after its last step. */
export interface AirJamInputLogCut {
  ticks: number;
  entryCount: number;
}

/** Collects a bounded input log. Entry positions and ticks never change. */
export class InputRecorder {
  private readonly entries: AirJamInputLogEntry[] = [];
  private bytes = 0;
  private ticks = 0;
  private committedCount = 0;
  private frozen = false;

  /** Number of appended entries, used to index separate wall times; never serialized into the replay log. */
  get entryCount(): number {
    return this.entries.length;
  }

  get full(): boolean {
    return this.frozen;
  }

  private append(entry: AirJamInputLogEntry): boolean {
    const bytes = JSON.stringify(entry).length;
    if (this.bytes + bytes > AIR_JAM_INPUT_LOG_MAX_ENTRY_BYTES) {
      this.frozen = true;
      return false;
    }
    this.entries.push(entry);
    this.bytes += bytes;
    return true;
  }

  /** Notes an event between steps with the tick it will reach. */
  record(event: AirJamInputLogEvent, payload: object): void {
    if (this.full) return;
    this.append({
      tick: this.ticks + 1,
      event,
      payload: structuredClone(payload) as Record<string, unknown>,
    });
  }

  /** Commits a whole step only if its time and all its entries fit. */
  flush(
    tick: number,
    entries: readonly Omit<AirJamInputLogEntry, "tick">[],
    stepMs: number,
  ): void {
    if (this.full) return;
    if (tick * stepMs > AIR_JAM_INPUT_LOG_MAX_GAME_MS) {
      this.frozen = true;
      return;
    }
    for (const entry of entries) {
      if (!this.append({ tick, ...entry })) return;
    }
    this.ticks = tick;
    this.committedCount = this.entries.length;
  }

  log(
    header: Omit<AirJamInputLog, "version" | "entries" | "ticks">,
    cut?: AirJamInputLogCut,
  ): AirJamInputLog {
    const ticks = cut?.ticks ?? this.ticks;
    const count =
      cut?.entryCount ??
      (this.full ? this.committedCount : this.entries.length);
    if (
      cut &&
      (ticks > this.ticks ||
        count > this.entries.length ||
        (count > 0 && this.entries[count - 1].tick > ticks + 1))
    )
      throw new Error("Invalid input log cut.");
    return {
      version: 2,
      ...header,
      ticks,
      // Retain the bounded backing prefix even on overflow: a previously read
      // cut may include pending entries, although a new full log excludes them.
      entries: this.entries.slice(0, count),
    };
  }
}
