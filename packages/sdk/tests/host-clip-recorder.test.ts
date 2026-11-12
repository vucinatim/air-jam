import { afterEach, expect, it, vi } from "vitest";
import {
  CLIP_FRAME_MAX_BYTES,
  CLIP_MAX_BYTES,
  CLIP_PAGE_BASE64_CHARS,
  clipArtifactSchema,
  clipFrameSchema,
} from "../src/runtime/contracts/clip";
import type { HostObservationSurface } from "../src/runtime/contracts/observation";
import {
  clipFailureReason,
  readHostClip,
} from "../src/runtime/host-clip-reader";
import { HostClipRecorder } from "../src/runtime/host-clip-recorder";
import { observationFixture } from "./fixtures/host-observation";

const identity = {
  roomId: "ROOM",
  documentId: "doc",
  contractId: "contract",
  runtimeId: "runtime",
  surfaceId: "surface",
  participantId: "participant",
};
const image = (bytes = 3) => ({
  data: Buffer.alloc(bytes).toString("base64"),
  width: 640,
  height: 360,
  mimeType: "image/jpeg" as const,
  coverage: "render-surface" as const,
});
function fixture(
  capture: HostObservationSurface["capture"] | null = () => image(),
) {
  vi.useFakeTimers();
  const recorder = new HostClipRecorder({
    capture: () => capture,
    now: () => Date.now(),
    wallNow: () => Date.now(),
  });
  return recorder;
}
afterEach(() => vi.useRealTimers());

it("keeps native video out of the still sampler and waits for final bytes before delivery", async () => {
  const stop = vi.fn(async () => {});
  const dispose = vi.fn();
  const page = vi.fn(() => ({
    mimeType: "video/webm",
    width: 1280,
    height: 720,
    chunks: ["YWJj"],
    nextChunk: null,
  }));
  const capture = Object.assign(
    vi.fn(() => image()),
    {
      startVideo: vi.fn(() => ({ stop, dispose, page, frameCount: () => 30 })),
    },
  );
  const recorder = fixture(capture);
  recorder.start("native", identity, 1, "video");
  await vi.advanceTimersByTimeAsync(1000);
  expect(capture).not.toHaveBeenCalled();
  expect(capture.startVideo).toHaveBeenCalledWith(33);
  await recorder.stop("native");
  expect(stop).toHaveBeenCalledOnce();
  expect(recorder.read("native", true, 0)).toMatchObject({
    state: "stopped",
    frameIntervalMs: 33,
    frames: [],
    video: { chunks: ["YWJj"] },
  });
  recorder.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});

it("enforces decoded bytes, dimensions, count, order and kept time window", () => {
  const frame = { ...image(), index: 0, atMs: 100 };
  const { coverage, ...valid } = frame;
  void coverage;
  expect(clipFrameSchema.parse(valid)).toEqual(valid);
  expect(
    clipFrameSchema.safeParse({
      ...valid,
      data: image(CLIP_FRAME_MAX_BYTES + 1).data,
    }).success,
  ).toBe(false);
  expect(clipFrameSchema.safeParse({ ...valid, width: 1281 }).success).toBe(
    false,
  );
  expect(clipFrameSchema.safeParse({ ...valid, height: 1281 }).success).toBe(
    false,
  );
  const clip = {
    version: 1,
    clipId: "clip",
    identity,
    startedAt: new Date().toISOString(),
    frameIntervalMs: 100,
    durationMs: 1000,
    droppedFrames: 0,
    skippedFrames: 0,
    frames: [valid],
  };
  expect(clipArtifactSchema.safeParse(clip).success).toBe(true);
  for (const frames of [
    [],
    [valid, valid],
    Array.from({ length: 151 }, (_, index) => ({
      ...valid,
      index,
      atMs: index * 100,
    })),
  ])
    expect(clipArtifactSchema.safeParse({ ...clip, frames }).success).toBe(
      false,
    );
  expect(
    clipArtifactSchema.safeParse({
      ...clip,
      durationMs: 15000,
      frames: Array.from({ length: 151 }, (_, index) => ({
        ...valid,
        index,
        atMs: index * 100,
      })),
    }).success,
  ).toBe(false);
  expect(
    clipArtifactSchema.safeParse({ ...clip, durationMs: 16000 }).success,
  ).toBe(false);
  const large = clipFrameSchema.parse({
    ...valid,
    data: image(CLIP_FRAME_MAX_BYTES).data,
  });
  expect(
    clipArtifactSchema.safeParse({
      ...clip,
      durationMs: 3000,
      frames: Array.from({ length: 30 }, (_, index) => ({
        ...large,
        index,
        atMs: index * 100,
      })),
    }).success,
  ).toBe(false);
});
it("keeps the last 15 seconds and at most 150 frames on the original host clock", async () => {
  const recorder = fixture();
  recorder.start("clip", identity);
  await vi.advanceTimersByTimeAsync(16000);
  const clip = recorder.read("clip", true, 0);
  expect(clip.frameCount).toBe(150);
  expect(clip.droppedFrames).toBe(10);
  expect(clip.frames[0].atMs).toBe(1100);
  expect(clip.durationMs).toBe(16000);
});
it("trims decoded bytes and pages frozen indexes within the socket budget", async () => {
  const recorder = fixture(() => image(CLIP_FRAME_MAX_BYTES));
  recorder.start("clip", identity);
  await vi.advanceTimersByTimeAsync(3000);
  const first = recorder.read("clip", true, 0);
  expect(first.frameCount).toBe(
    Math.floor(CLIP_MAX_BYTES / CLIP_FRAME_MAX_BYTES),
  );
  expect(first.droppedFrames).toBe(5);
  expect(
    first.frames.reduce((sum, frame) => sum + frame.data.length, 0),
  ).toBeLessThanOrEqual(CLIP_PAGE_BASE64_CHARS);
  const result = await readHostClip(
    async (request) => {
      if (request.operation !== "clip-read")
        throw new Error("unexpected request");
      return {
        operation: "clip-read",
        clip: recorder.read(request.clipId, request.stop, request.fromFrame),
      };
    },
    "clip",
    identity,
  );
  expect(result.status).toBe("captured");
  if (result.status === "captured")
    expect(result.artifact.frames).toHaveLength(first.frameCount);
  await vi.advanceTimersByTimeAsync(20000);
  expect(recorder.read("clip", true, 0)).toEqual(first);
});
it.each([
  [(): null => null, "surface-unavailable"],
  [() => image(CLIP_FRAME_MAX_BYTES + 1), "surface-unavailable"],
  [
    () => {
      throw new Error("private capture failure");
    },
    "capture-failed",
  ],
] as const)(
  "counts unsuccessful attempts honestly",
  async (capture, reason) => {
    const recorder = fixture(capture);
    recorder.start("clip", identity);
    await vi.advanceTimersByTimeAsync(200);
    expect(recorder.read("clip", true, 0)).toMatchObject({
      skippedFrames: 2,
      frames: [],
      notCaptured: reason,
    });
  },
);
it("keeps still-sized captures that ignore options and skips them over the byte cap", async () => {
  let oversized = false;
  const capture = vi.fn(() => ({
    ...image(CLIP_FRAME_MAX_BYTES + (oversized ? 1 : 0)),
    width: 1280,
    height: 720,
  }));
  const recorder = fixture(capture);
  recorder.start("clip", identity);
  await vi.advanceTimersByTimeAsync(100);
  expect(capture).toHaveBeenCalledWith({ maxEdge: 1280, quality: 0.92 });
  expect(recorder.read("clip", false, 0)).toMatchObject({
    frameCount: 1,
    skippedFrames: 0,
    frames: [{ width: 1280, height: 720 }],
  });
  oversized = true;
  await vi.advanceTimersByTimeAsync(100);
  expect(recorder.read("clip", true, 0)).toMatchObject({
    frameCount: 1,
    skippedFrames: 1,
  });
  const result = await readHostClip(
    async (request) => {
      if (request.operation !== "clip-read")
        throw new Error("Unexpected clip operation.");
      return {
        operation: "clip-read",
        clip: recorder.read(request.clipId, request.stop, request.fromFrame),
      };
    },
    "clip",
    identity,
  );
  expect(result.status).toBe("captured");
  if (result.status === "captured")
    expect(clipArtifactSchema.parse(result.artifact).frames[0].width).toBe(
      1280,
    );
  recorder.dispose();
});
it("refuses no surface and reports busy only when all four clips are recording", () => {
  expect(() => fixture(null).start("clip", identity)).toThrow(
    "clip_unsupported:",
  );
  const recorder = fixture();
  for (let i = 0; i < 4; i++) recorder.start(String(i), identity);
  let refusal: unknown;
  try {
    recorder.start("fifth", identity);
  } catch (error) {
    refusal = error;
  }
  expect(String(refusal)).toContain("clip_busy:");
  expect(clipFailureReason(refusal)).toBe("busy");
  for (let i = 0; i < 4; i++)
    expect(recorder.read(String(i), false, 0).state).toBe("recording");
  recorder.read("0", true, 0);
  expect(recorder.start("fifth", identity).clipId).toBe("fifth");
  expect(() => recorder.read("0", false, 0)).toThrow("clip_not_found:");
  recorder.dispose();
});
it("captures eight sequential five-second clips within a minute", async () => {
  const recorder = fixture();
  const started = Date.now();
  for (let i = 0; i < 8; i++) {
    const clipId = String(i);
    recorder.start(clipId, identity);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await readHostClip(
      async (request) => {
        if (request.operation !== "clip-read")
          throw new Error("Unexpected clip operation.");
        return {
          operation: "clip-read",
          clip: recorder.read(request.clipId, request.stop, request.fromFrame),
        };
      },
      clipId,
      identity,
    );
    expect(result.status).toBe("captured");
    if (result.status === "captured") {
      expect(result.artifact.durationMs).toBe(5000);
      expect(result.artifact.frames).toHaveLength(50);
    }
  }
  expect(Date.now() - started).toBe(40000);
  expect(() => recorder.read("3", false, 0)).toThrow("clip_not_found:");
  for (let i = 4; i < 8; i++)
    expect(recorder.read(String(i), false, 0).state).toBe("stopped");
  recorder.dispose();
});
it("evicts the least recently read stopped clip and preserves active recordings", async () => {
  const recorder = fixture();
  for (const id of ["active", "a", "b", "c"]) recorder.start(id, identity);
  await vi.advanceTimersByTimeAsync(1000);
  const a = recorder.read("a", true, 0);
  await vi.advanceTimersByTimeAsync(100);
  recorder.read("b", true, 0);
  await vi.advanceTimersByTimeAsync(100);
  const c = recorder.read("c", true, 0);
  await vi.advanceTimersByTimeAsync(100);
  expect(recorder.read("a", false, 0)).toEqual(a);
  recorder.start("new", identity);
  expect(() => recorder.read("b", false, 0)).toThrow("clip_not_found:");
  expect(recorder.read("a", false, 0)).toEqual(a);
  expect(recorder.read("c", false, 0)).toEqual(c);
  for (const id of ["active", "new"])
    expect(recorder.read(id, false, 0).state).toBe("recording");
  recorder.dispose();
});
it("protects a stopped clip while its remaining pages are being delivered", async () => {
  const recorder = fixture(() => image(CLIP_FRAME_MAX_BYTES));
  for (const id of ["clip", "a", "b", "c"]) recorder.start(id, identity);
  await vi.advanceTimersByTimeAsync(400);
  const result = await readHostClip(
    async (request) => {
      if (request.operation !== "clip-read")
        throw new Error("Unexpected clip operation.");
      const clip = recorder.read(
        request.clipId,
        request.stop,
        request.fromFrame,
      );
      expect(clip.frameCount).toBe(4);
      if (clip.nextFrame !== null) {
        let refusal: unknown;
        try {
          recorder.start("new", identity);
        } catch (error) {
          refusal = error;
        }
        expect(String(refusal)).toContain(
          "clip_busy: Four clips are already recording or being delivered in this runtime.",
        );
        expect(clipFailureReason(refusal)).toBe("busy");
      }
      return { operation: "clip-read", clip };
    },
    "clip",
    identity,
  );
  expect(result.status).toBe("captured");
  if (result.status === "captured")
    expect(result.artifact.frames.map((frame) => frame.index)).toEqual([
      0, 1, 2, 3,
    ]);
  recorder.dispose();
});
it("reclaims only a delivered stopped buffer while other clips record or transfer", async () => {
  const recorder = fixture(() => image(CLIP_FRAME_MAX_BYTES));
  for (const id of ["undelivered", "delivered", "a", "b"])
    recorder.start(id, identity);
  await vi.advanceTimersByTimeAsync(100);
  expect(recorder.read("undelivered", false, 0).nextFrame).toBeNull();
  await vi.advanceTimersByTimeAsync(300);
  const undelivered = recorder.read("undelivered", true, 0);
  expect(undelivered.nextFrame).not.toBeNull();
  const first = recorder.read("delivered", true, 0);
  recorder.read("delivered", true, first.nextFrame!);
  recorder.start("new", identity);
  expect(() => recorder.read("delivered", false, 0)).toThrow("clip_not_found:");
  expect(recorder.read("undelivered", false, 0)).toEqual(undelivered);
  for (const id of ["a", "b", "new"])
    expect(recorder.read(id, false, 0).state).toBe("recording");
  recorder.dispose();
});
it("expires an undelivered stopped clip after a minute without reads", async () => {
  const recorder = fixture(() => image(CLIP_FRAME_MAX_BYTES));
  recorder.start("clip", identity);
  await vi.advanceTimersByTimeAsync(400);
  expect(recorder.read("clip", true, 0).nextFrame).not.toBeNull();
  await vi.advanceTimersByTimeAsync(60000);
  expect(() => recorder.read("clip", false, 0)).toThrow("clip_not_found:");
  recorder.dispose();
});
it("self-stops at ten minutes and releases stopped unread recordings after a minute", () => {
  let now = 0;
  let tick!: () => void;
  const recorder = new HostClipRecorder({
    capture: () => () => image(),
    now: () => now,
    schedule: (callback) => {
      tick = callback;
      return () => {};
    },
  });
  recorder.start("clip", identity);
  now = 600000;
  tick();
  expect(recorder.read("clip", false, 0).state).toBe("stopped");
  now += 60000;
  tick();
  expect(() => recorder.read("clip", false, 0)).toThrow("clip_not_found:");
});
it("shares one capture, skips busy ticks and discards in-flight work after dispose", async () => {
  let resolve!: (value: ReturnType<typeof image>) => void;
  const capture = vi.fn(
    () =>
      new Promise<ReturnType<typeof image>>((done) => {
        resolve = done;
      }),
  );
  const recorder = fixture(capture);
  recorder.start("a", identity);
  recorder.start("b", identity);
  await vi.advanceTimersByTimeAsync(500);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(capture).toHaveBeenCalledWith({ maxEdge: 1280, quality: 0.92 });
  resolve(image());
  await Promise.resolve();
  expect(recorder.read("a", false, 0).frames).toEqual(
    recorder.read("b", false, 0).frames,
  );
  await vi.advanceTimersByTimeAsync(100);
  recorder.dispose();
  resolve(image());
  await Promise.resolve();
  expect(() => recorder.read("a", true, 0)).toThrow("clip_not_found:");
});

it("starts and promptly reads clips through HostRuntimeControl.agent", async () => {
  const recorder = fixture();
  const game = observationFixture();
  const removeSurface = game.surface({ read: () => ({ state: {} }) });
  const removeReceiver = game.receiver({ clips: recorder });
  const observation = await game.observe({
    ...game.request,
    includeImage: false,
  });
  const response = await game.control.agent({
    operation: "clip-start",
    roomId: "ROOM",
    runtimeId: observation.identity.runtimeId,
    clipId: "clip",
    frameIntervalMs: 33,
  });
  expect(response.operation).toBe("clip-start");
  await vi.advanceTimersByTimeAsync(100);
  const read = await game.control.agent({
    operation: "clip-read",
    roomId: "ROOM",
    clipId: "clip",
    stop: true,
    fromFrame: 0,
  });
  expect(read).toMatchObject({
    operation: "clip-read",
    clip: {
      state: "stopped",
      frameCount: 3,
      frameIntervalMs: 33,
      identity: observation.identity,
    },
  });
  await expect(
    game.control.agent({
      operation: "clip-start",
      roomId: "ROOM",
      runtimeId: "old-runtime",
      clipId: "another",
    }),
  ).rejects.toThrow("runtime_replaced:");
  recorder.dispose();
  removeReceiver();
  removeSurface();
  game.close();
});

it("starts sampling a replacement surface even when the disposed capture never answered", async () => {
  vi.useFakeTimers();
  let blocked = true;
  const recorder = new HostClipRecorder({
    now: () => Date.now(),
    capture: () => () => (blocked ? new Promise<null>(() => {}) : image()),
  });
  recorder.start("old", identity);
  await vi.advanceTimersByTimeAsync(100);
  recorder.dispose();
  blocked = false;
  recorder.start("new", identity);
  await vi.advanceTimersByTimeAsync(100);
  expect(recorder.read("new", true, 0).frameCount).toBe(1);
  expect(() => recorder.read("old", true, 0)).toThrow("clip_not_found:");
  recorder.dispose();
});

it("passes clip and still dimensions and quality into the canvas encoder", async () => {
  const { captureAgentCanvas } = await import("../src/agent/capture-canvas");
  const drawImage = vi.fn();
  const output = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toDataURL: vi.fn(() => "data:image/jpeg;base64,YWJj"),
  };
  const canvas = {
    width: 2560,
    height: 1440,
    ownerDocument: { createElement: () => output },
  } as unknown as HTMLCanvasElement;
  expect(
    captureAgentCanvas(canvas, { maxEdge: 640, quality: 0.7 }),
  ).toMatchObject({ width: 640, height: 360 });
  expect(output.toDataURL).toHaveBeenLastCalledWith("image/jpeg", 0.7);
  expect(
    captureAgentCanvas(canvas, { maxEdge: 1280, quality: 0.8 }),
  ).toMatchObject({ width: 1280, height: 720 });
  expect(output.toDataURL).toHaveBeenLastCalledWith("image/jpeg", 0.8);
  expect(captureAgentCanvas(canvas)).toMatchObject({
    width: 1280,
    height: 720,
  });
  expect(output.toDataURL).toHaveBeenLastCalledWith("image/jpeg", 0.8);
});

it("captures at the requested cadence, floors at 33 ms and preserves the 100 ms default", async () => {
  const recorder = fixture();
  recorder.start("tool", identity, 33);
  recorder.start("floor", identity, 1);
  recorder.start("test", identity);
  await vi.advanceTimersByTimeAsync(990);
  const tool = recorder.read("tool", true, 0);
  expect(tool.frameIntervalMs).toBe(33);
  expect(tool.frames.map((frame) => frame.atMs)).toEqual(
    Array.from({ length: 30 }, (_, index) => (index + 1) * 33),
  );
  expect(recorder.read("floor", true, 0).frames).toEqual(tool.frames);
  expect(recorder.read("test", true, 0)).toMatchObject({
    frameIntervalMs: 100,
    frameCount: 9,
  });
  recorder.dispose();
});
it("retains the faster cadence within the same time and byte bounds", async () => {
  const recorder = fixture();
  recorder.start("clip", identity, 33);
  await vi.advanceTimersByTimeAsync(16005);
  const clip = recorder.read("clip", true, 0);
  const {
    identity: observedIdentity,
    clipId,
    startedAt,
    durationMs,
    droppedFrames,
    skippedFrames,
    frames,
    frameIntervalMs,
  } = clip;
  const artifact = {
    identity: observedIdentity,
    clipId,
    startedAt,
    durationMs,
    droppedFrames,
    skippedFrames,
    frames,
    frameIntervalMs,
  };
  expect(clip.frameCount).toBe(455);
  expect(
    clipArtifactSchema.parse({ version: 1, ...artifact }).frameIntervalMs,
  ).toBe(33);
  recorder.dispose();
});

it("keeps the sampler's requested ticks when browser timers arrive slightly early", async () => {
  let now = 0;
  let tick!: () => void;
  const recorder = new HostClipRecorder({
    capture: () => () => image(),
    now: () => now,
    schedule: (callback) => {
      tick = callback;
      return () => {};
    },
  });
  recorder.start("clip", identity, 33);
  for (const timestamp of [32.9, 65.8, 98.7]) {
    now = timestamp;
    tick();
    await Promise.resolve();
  }
  expect(
    recorder.read("clip", true, 0).frames.map((frame) => frame.atMs),
  ).toEqual([32.9, 65.8, 98.7]);
  recorder.dispose();
});
