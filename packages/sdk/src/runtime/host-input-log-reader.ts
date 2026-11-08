import { airJamInputLogSchema, type AirJamInputLog } from "../core/input-log";
import type {
  HostAgentRequest,
  HostAgentResponse,
} from "./contracts/agent-control";
import {
  hostInputLogPageSchema,
  type HostInputLogPage,
  type InputLogNotReplayableReason,
} from "./contracts/input-log";
import {
  sameHostRuntimeIdentity,
  type HostObservationIdentity,
} from "./contracts/runtime-identity";

export function inputLogFailureReason(
  error: unknown,
): InputLogNotReplayableReason {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("replay_unsupported:")) return "no-simulation";
  if (message.startsWith("replay_loading:")) return "loading";
  if (message.startsWith("runtime_replaced:")) return "runtime-replaced";
  return "host-unavailable";
}

/** Reads one cut while the match keeps playing. Reading needs no room grant. */
export async function readHostInputLog(
  request: (request: HostAgentRequest) => Promise<HostAgentResponse>,
  expected: HostObservationIdentity,
): Promise<
  | { status: "recorded"; log: AirJamInputLog; full: boolean }
  | {
      status: "not-replayable";
      reason: InputLogNotReplayableReason;
      message: string;
    }
> {
  let fromEntry = 0;
  let first: HostInputLogPage | undefined;
  const entries: AirJamInputLog["entries"] = [];
  for (;;) {
    let response: HostAgentResponse;
    try {
      response = await request({
        operation: "input-log-read",
        roomId: expected.roomId,
        runtimeId: expected.runtimeId,
        cut: first
          ? { ticks: first.header.ticks, entryCount: first.entryCount }
          : null,
        fromEntry,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "not-replayable",
        reason: inputLogFailureReason(error),
        message: message.replace(/^[a-z_]+:\s*/, ""),
      };
    }
    if (response.operation !== "input-log-read")
      throw new Error("Invalid input log response operation.");
    const page = hostInputLogPageSchema.parse(response.page);
    if (!sameHostRuntimeIdentity(expected, page.identity))
      return {
        status: "not-replayable",
        reason: "runtime-replaced",
        message: "The recording runtime was replaced.",
      };
    first ??= page;
    if (
      JSON.stringify(page.header) !== JSON.stringify(first.header) ||
      page.entryCount !== first.entryCount
    )
      throw new Error("Input log changed while paging.");
    entries.push(...page.entries);
    const next = fromEntry + page.entries.length;
    if (next > first.entryCount)
      throw new Error("Input log entry count exceeds its cut.");
    if (page.nextEntry === null) {
      if (next !== first.entryCount)
        throw new Error("Input log entry count differs from its cut.");
      break;
    }
    if (
      page.nextEntry !== next ||
      next <= fromEntry ||
      next >= first.entryCount
    )
      throw new Error("Input log page did not advance.");
    fromEntry = next;
  }
  const log = airJamInputLogSchema.parse({ ...first.header, entries });
  if (
    entries.some(
      (entry, index) =>
        entry.tick > log.ticks + 1 ||
        entry.tick < (entries[index - 1]?.tick ?? 1),
    )
  )
    throw new Error("Invalid input log entry ticks.");
  // Fullness belongs to the cut: a recording that fills after it leaves it whole.
  return { status: "recorded", log, full: first.full };
}
