import type {
  HostAgentRequest,
  HostAgentResponse,
} from "./contracts/agent-control";
import {
  clipArtifactSchema,
  type ClipArtifact,
  type ClipNotCapturedReason,
} from "./contracts/clip";
import {
  sameHostRuntimeIdentity,
  type HostObservationIdentity,
} from "./contracts/runtime-identity";

/** Evidence failure never determines a game's verdict. */
export function clipFailureReason(error: unknown): ClipNotCapturedReason {
  const message = error instanceof Error ? error.message : String(error);
  if (/^clip_busy:/.test(message)) return "busy";
  if (/^clip_unsupported:/.test(message)) return "unsupported";
  if (/^(clip_not_found|runtime_replaced|observation_replaced):/.test(message))
    return "runtime-replaced";
  return "host-unavailable";
}
type ClipPage = Extract<HostAgentResponse, { operation: "clip-read" }>["clip"];
const pageMetadata = (page: ClipPage) =>
  JSON.stringify({ ...page, frames: undefined, nextFrame: undefined });

/** Stop first, then read immutable pages through the same host-agent channel as observations. */
export async function readHostClip(
  request: (request: HostAgentRequest) => Promise<HostAgentResponse>,
  clipId: string,
  expected: HostObservationIdentity,
): Promise<
  | { status: "captured"; artifact: ClipArtifact }
  | { status: "not-captured"; reason: ClipNotCapturedReason }
> {
  let fromFrame = 0;
  let first: ClipPage | undefined;
  const frames: ClipArtifact["frames"] = [];
  for (;;) {
    const response = await request({
      operation: "clip-read",
      roomId: expected.roomId,
      clipId,
      stop: true,
      fromFrame,
    });
    if (response.operation !== "clip-read")
      throw new Error("Invalid clip response operation.");
    const page = response.clip;
    if (
      page.clipId !== clipId ||
      page.state !== "stopped" ||
      !sameHostRuntimeIdentity(expected, page.identity)
    )
      throw new Error(
        "runtime_replaced: Clip belongs to another recording runtime.",
      );
    first ??= page;
    if (pageMetadata(page) !== pageMetadata(first))
      throw new Error("Clip changed while paging.");
    if (page.notCaptured)
      return { status: "not-captured", reason: page.notCaptured };
    if (page.frames.some((frame) => frame.index < fromFrame))
      throw new Error("Invalid clip page cursor.");
    frames.push(...page.frames);
    if (frames.length > 150) throw new Error("Clip frame allowance exceeded.");
    if (page.nextFrame === null) break;
    if (
      !page.frames.length ||
      page.nextFrame <= fromFrame ||
      page.nextFrame !== page.frames.at(-1)!.index + 1
    )
      throw new Error("Clip page did not advance.");
    fromFrame = page.nextFrame;
  }
  if (frames.length !== first.frameCount)
    throw new Error("Clip frame count differs from its receipt.");
  return {
    status: "captured",
    artifact: clipArtifactSchema.parse({
      version: 1,
      clipId,
      identity: first.identity,
      startedAt: first.startedAt,
      frameIntervalMs: first.frameIntervalMs,
      durationMs: first.durationMs,
      droppedFrames: first.droppedFrames,
      skippedFrames: first.skippedFrames,
      frames,
    }),
  };
}
