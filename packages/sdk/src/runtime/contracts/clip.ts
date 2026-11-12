import { z } from "zod";
import { hostObservationIdentitySchema } from "./runtime-identity";

export const CLIP_FRAME_INTERVAL_MS = 100;
export const CLIP_MIN_FRAME_INTERVAL_MS = 33;
export const clipFrameIntervalSchema = z
  .number()
  .int()
  .min(CLIP_MIN_FRAME_INTERVAL_MS);
export const CLIP_FRAME_MAX_EDGE = 1280;
export const CLIP_FRAME_QUALITY = 0.92;
export const CLIP_MAX_DURATION_MS = 15_000;
export const CLIP_MAX_FRAMES = Math.ceil(
  CLIP_MAX_DURATION_MS / CLIP_MIN_FRAME_INTERVAL_MS,
);
export const CLIP_MAX_BYTES = 4 * 1024 * 1024;
export const CLIP_FRAME_MAX_BYTES = 160 * 1024;
export const CLIP_PAGE_BASE64_CHARS = 768 * 1024;
export const CLIP_RECORDING_LIFETIME_MS = 600_000;
export const CLIP_STOPPED_RELEASE_MS = 60_000;
export const CLIP_MAX_RECORDINGS = 4;
export const CLIP_VIDEO_MAX_DURATION_MS = 60_000;
export const CLIP_VIDEO_MAX_BYTES = 32 * 1024 * 1024;

export const clipNotCapturedReasonSchema = z.enum([
  "busy",
  "unsupported",
  "surface-unavailable",
  "capture-failed",
  "runtime-replaced",
  "host-unavailable",
  "headless",
]);
export const clipImageBytes = (data: string) =>
  (data.length / 4) * 3 -
  (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
export const clipFrameSchema = z
  .object({
    index: z.number().int().nonnegative(),
    atMs: z.number().nonnegative().max(CLIP_RECORDING_LIFETIME_MS),
    width: z.number().int().positive().max(1280),
    height: z.number().int().positive().max(1280),
    mimeType: z.literal("image/jpeg"),
    data: z
      .string()
      .min(4)
      .max(Math.ceil(CLIP_FRAME_MAX_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine(
        (data) =>
          data.length % 4 === 0 && clipImageBytes(data) <= CLIP_FRAME_MAX_BYTES,
        "Clip frame exceeds its byte budget or is invalid base64.",
      ),
  })
  .strict();
const clipMetadata = {
  clipId: z.string().min(1).max(128),
  identity: hostObservationIdentitySchema,
  startedAt: z.iso.datetime(),
  frameIntervalMs: clipFrameIntervalSchema,
  // Offsets and duration refer to the original recording, even after old frames drop.
  durationMs: z.number().nonnegative().max(CLIP_RECORDING_LIFETIME_MS),
  droppedFrames: z.number().int().nonnegative(),
  skippedFrames: z.number().int().nonnegative(),
};
export const clipArtifactSchema = z
  .object({
    version: z.literal(1),
    ...clipMetadata,
    frames: z.array(clipFrameSchema).min(1).max(CLIP_MAX_FRAMES),
  })
  .strict()
  .superRefine((clip, ctx) => {
    const frames = clip.frames;
    if (frames.length > Math.ceil(CLIP_MAX_DURATION_MS / clip.frameIntervalMs))
      ctx.addIssue({
        code: "custom",
        message: "Clip exceeds its cadence frame budget.",
      });
    if (
      frames.reduce((sum, frame) => sum + clipImageBytes(frame.data), 0) >
      CLIP_MAX_BYTES
    )
      ctx.addIssue({
        code: "custom",
        message: "Clip exceeds its image byte budget.",
      });
    if (
      frames.some(
        (frame, i) =>
          frame.atMs > clip.durationMs ||
          frame.atMs < clip.durationMs - CLIP_MAX_DURATION_MS ||
          (i > 0 &&
            (frame.atMs <= frames[i - 1].atMs ||
              frame.index !== frames[i - 1].index + 1)),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Clip frames must be ordered within the kept time window.",
      });
  });
export const clipVideoPageSchema = z
  .object({
    mimeType: z.string().min(1).max(128),
    width: z.number().int().positive().max(1280),
    height: z.number().int().positive().max(1280),
    chunks: z
      .array(
        z
          .string()
          .min(4)
          .max(CLIP_PAGE_BASE64_CHARS)
          .regex(
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
          ),
      )
      .max(1),
    nextChunk: z.number().int().nonnegative().nullable(),
  })
  .strict();

/** Browser binding supplies native recording; the host core stays DOM-free. */
export type NativeClipRecording = {
  stop: () => Promise<void>;
  page: (fromChunk: number) => z.infer<typeof clipVideoPageSchema>;
  frameCount: () => number;
  dispose: () => void;
};

export const clipReadSchema = z
  .object({
    ...clipMetadata,
    state: z.enum(["recording", "stopped"]),
    frameCount: z
      .number()
      .int()
      .nonnegative()
      .max(Math.ceil(CLIP_RECORDING_LIFETIME_MS / CLIP_MIN_FRAME_INTERVAL_MS)),
    notCaptured: clipNotCapturedReasonSchema.nullable(),
    frames: z
      .array(clipFrameSchema)
      .max(CLIP_MAX_FRAMES)
      .refine(
        (frames) =>
          frames.reduce((sum, frame) => sum + frame.data.length, 0) <=
          CLIP_PAGE_BASE64_CHARS,
        "Clip page exceeds its transfer budget.",
      ),
    nextFrame: z.number().int().nonnegative().nullable(),
    video: clipVideoPageSchema.optional(),
  })
  .strict();
export type ClipFrame = z.infer<typeof clipFrameSchema>;
export type ClipArtifact = z.infer<typeof clipArtifactSchema>;
export type ClipRead = z.infer<typeof clipReadSchema>;
export type ClipNotCapturedReason = z.infer<typeof clipNotCapturedReasonSchema>;
