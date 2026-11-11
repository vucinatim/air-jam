import {
  CLIP_FRAME_INTERVAL_MS,
  CLIP_FRAME_MAX_BYTES,
  CLIP_FRAME_MAX_EDGE,
  CLIP_FRAME_QUALITY,
  CLIP_MAX_BYTES,
  CLIP_MAX_DURATION_MS,
  CLIP_MAX_RECORDINGS,
  CLIP_MIN_FRAME_INTERVAL_MS,
  CLIP_PAGE_BASE64_CHARS,
  CLIP_RECORDING_LIFETIME_MS,
  CLIP_STOPPED_RELEASE_MS,
  clipFrameSchema,
  clipImageBytes,
  type ClipFrame,
  type ClipRead,
} from "./contracts/clip";
import type { HostObservationSurface } from "./contracts/observation";
import type { HostObservationIdentity } from "./contracts/runtime-identity";

type Recording = {
  identity: HostObservationIdentity;
  clipId: string;
  startedAt: string;
  start: number;
  frameIntervalMs: number;
  nextCaptureAt: number;
  stopped: number | null;
  delivered: boolean;
  lastRead: number;
  frames: ClipFrame[];
  bytes: number;
  nextIndex: number;
  droppedFrames: number;
  skippedFrames: number;
  attempts: number;
  errors: number;
};
/** When a stopped recording was last needed; null while it records. */
const idleSince = (recording: Recording) =>
  recording.stopped === null
    ? null
    : Math.max(recording.stopped, recording.lastRead);
/** One non-queuing sampler per runtime; the clock and scheduler are replaceable in tests. */
export class HostClipRecorder {
  private readonly recordings = new Map<string, Recording>();
  private stopTimer: (() => void) | null = null;
  private scheduledIntervalMs = 0;
  private capturing = false;
  private generation = 0;
  constructor(
    private readonly source: {
      capture: () => HostObservationSurface["capture"] | null;
      now: () => number;
      wallNow?: () => number;
      schedule?: (tick: () => void, intervalMs: number) => () => void;
      onCaptureError?: (error: unknown) => void;
    },
  ) {}

  start(
    clipId: string,
    identity: HostObservationIdentity,
    frameIntervalMs = CLIP_FRAME_INTERVAL_MS,
  ) {
    if (!Number.isInteger(frameIntervalMs) || frameIntervalMs <= 0)
      throw new Error("Clip frame interval must be a positive integer.");
    frameIntervalMs = Math.max(CLIP_MIN_FRAME_INTERVAL_MS, frameIntervalMs);
    if (!this.source.capture())
      throw new Error("clip_unsupported: The game has no capture surface.");
    this.sweep();
    const previous = this.recordings.get(clipId);
    if (previous) return { clipId, startedAt: previous.startedAt };
    if (this.recordings.size >= CLIP_MAX_RECORDINGS) {
      let oldest: Recording | undefined;
      for (const recording of this.recordings.values()) {
        const since = idleSince(recording);
        if (
          since !== null &&
          recording.delivered &&
          (!oldest || since < idleSince(oldest)!)
        )
          oldest = recording;
      }
      if (!oldest)
        throw new Error(
          "clip_busy: Four clips are already recording or being delivered in this runtime.",
        );
      // Delivered clips are retry buffers; protect unfinished transfers.
      this.recordings.delete(oldest.clipId);
    }
    const now = this.source.now();
    const recording: Recording = {
      identity,
      clipId,
      startedAt: new Date(this.source.wallNow?.() ?? Date.now()).toISOString(),
      start: now,
      frameIntervalMs,
      nextCaptureAt: now + frameIntervalMs,
      stopped: null,
      delivered: false,
      lastRead: now,
      frames: [],
      bytes: 0,
      nextIndex: 0,
      droppedFrames: 0,
      skippedFrames: 0,
      attempts: 0,
      errors: 0,
    };
    this.recordings.set(clipId, recording);
    this.schedule();
    return { clipId, startedAt: recording.startedAt };
  }

  private schedule() {
    const intervalMs = Math.min(
      ...[...this.recordings.values()]
        .filter((recording) => recording.stopped === null)
        .map((recording) => recording.frameIntervalMs),
    );
    if (intervalMs === this.scheduledIntervalMs) return;
    this.stopTimer?.();
    this.stopTimer = null;
    this.scheduledIntervalMs = intervalMs;
    if (!Number.isFinite(intervalMs)) return;
    const schedule =
      this.source.schedule ??
      ((tick, ms) => {
        const timer = setInterval(tick, ms);
        return () => clearInterval(timer);
      });
    this.stopTimer = schedule(() => {
      void this.sample();
    }, intervalMs);
  }

  private trim(recording: Recording, now: number) {
    while (
      recording.frames.length &&
      (recording.frames[0].atMs <
        now - recording.start - CLIP_MAX_DURATION_MS ||
        recording.frames.length >
          Math.ceil(CLIP_MAX_DURATION_MS / recording.frameIntervalMs) ||
        recording.bytes > CLIP_MAX_BYTES)
    ) {
      recording.bytes -= clipImageBytes(recording.frames.shift()!.data);
      recording.droppedFrames++;
    }
  }
  private sweep() {
    const now = this.source.now();
    for (const [id, recording] of this.recordings) {
      if (
        recording.stopped === null &&
        now - recording.start >= CLIP_RECORDING_LIFETIME_MS
      ) {
        recording.stopped = recording.start + CLIP_RECORDING_LIFETIME_MS;
        this.trim(recording, recording.stopped);
      }
      const since = idleSince(recording);
      if (since !== null && now - since >= CLIP_STOPPED_RELEASE_MS)
        this.recordings.delete(id);
    }
    this.schedule();
  }
  private async sample() {
    this.sweep();
    if (this.capturing) return;
    const now = this.source.now();
    const active = [...this.recordings.values()].filter(
      (recording) =>
        recording.stopped === null &&
        (recording.frameIntervalMs === this.scheduledIntervalMs ||
          now >= recording.nextCaptureAt),
    );
    if (!active.length) return;
    const generation = this.generation;
    for (const recording of active) {
      recording.nextCaptureAt +=
        (Math.floor(
          (now - recording.nextCaptureAt) / recording.frameIntervalMs,
        ) +
          1) *
        recording.frameIntervalMs;
      this.trim(recording, now);
    }
    const capture = this.source.capture();
    this.capturing = true;
    let image: Awaited<ReturnType<NonNullable<typeof capture>>> = null;
    let failed = false;
    try {
      image =
        (await capture?.({
          maxEdge: CLIP_FRAME_MAX_EDGE,
          quality: CLIP_FRAME_QUALITY,
        })) ?? null;
    } catch (error) {
      failed = true;
      if (active.some((recording) => recording.errors === 0))
        this.source.onCaptureError?.(error);
    } finally {
      if (generation === this.generation) this.capturing = false;
    }
    if (generation !== this.generation) return;
    for (const recording of active) {
      if (
        this.recordings.get(recording.clipId) !== recording ||
        recording.stopped !== null
      )
        continue;
      recording.attempts++;
      if (failed) recording.errors++;
      const atMs = now - recording.start;
      const parsed =
        image &&
        clipFrameSchema.safeParse({
          index: recording.nextIndex,
          atMs,
          width: image.width,
          height: image.height,
          mimeType: image.mimeType,
          data: image.data,
        });
      if (
        !parsed ||
        !parsed.success ||
        clipImageBytes(parsed.data.data) > CLIP_FRAME_MAX_BYTES ||
        atMs <= (recording.frames.at(-1)?.atMs ?? -1)
      ) {
        recording.skippedFrames++;
        continue;
      }
      recording.frames.push(parsed.data);
      recording.nextIndex++;
      recording.bytes += clipImageBytes(parsed.data.data);
      this.trim(recording, this.source.now());
    }
  }

  read(clipId: string, stop: boolean, fromFrame: number): ClipRead {
    this.sweep();
    const recording = this.recordings.get(clipId);
    if (!recording)
      throw new Error(
        "clip_not_found: Recording was released or its runtime was replaced.",
      );
    const now = this.source.now();
    recording.lastRead = now;
    if (recording.stopped === null) {
      if (stop) recording.stopped = now;
      this.trim(recording, now);
    }
    const frames: ClipFrame[] = [];
    let chars = 0;
    let nextFrame: number | null = null;
    for (const frame of recording.frames) {
      if (frame.index < fromFrame) continue;
      if (chars + frame.data.length > CLIP_PAGE_BASE64_CHARS) {
        nextFrame = frame.index;
        break;
      }
      frames.push(frame);
      chars += frame.data.length;
    }
    if (recording.stopped !== null && nextFrame === null)
      recording.delivered = true;
    return {
      clipId,
      identity: recording.identity,
      startedAt: recording.startedAt,
      state: recording.stopped === null ? "recording" : "stopped",
      frameIntervalMs: recording.frameIntervalMs,
      durationMs: Math.min(
        CLIP_RECORDING_LIFETIME_MS,
        (recording.stopped ?? now) - recording.start,
      ),
      frameCount: recording.frames.length,
      droppedFrames: recording.droppedFrames,
      skippedFrames: recording.skippedFrames,
      notCaptured: recording.frames.length
        ? null
        : recording.attempts > 0 && recording.errors === recording.attempts
          ? "capture-failed"
          : "surface-unavailable",
      frames,
      nextFrame,
    };
  }
  dispose() {
    this.generation++;
    this.capturing = false;
    this.recordings.clear();
    this.stopTimer?.();
    this.stopTimer = null;
    this.scheduledIntervalMs = 0;
  }
}
