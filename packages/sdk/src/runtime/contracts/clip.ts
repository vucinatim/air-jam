import { z } from "zod";
import { hostObservationIdentitySchema } from "./runtime-identity";

export const CLIP_FRAME_INTERVAL_MS = 100;
export const CLIP_FRAME_MAX_EDGE = 640;
export const CLIP_FRAME_QUALITY = 0.7;
export const CLIP_MAX_DURATION_MS = 15_000;
export const CLIP_MAX_BYTES = 4 * 1024 * 1024;
export const CLIP_FRAME_MAX_BYTES = 160 * 1024;
export const CLIP_PAGE_BASE64_CHARS = 768 * 1024;
export const CLIP_RECORDING_LIFETIME_MS = 600_000;
export const CLIP_STOPPED_RELEASE_MS = 60_000;
export const CLIP_MAX_RECORDINGS = 4;

export const clipNotCapturedReasonSchema = z.enum([
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
    width: z.number().int().positive().max(CLIP_FRAME_MAX_EDGE),
    height: z.number().int().positive().max(CLIP_FRAME_MAX_EDGE),
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
  frameIntervalMs: z.literal(CLIP_FRAME_INTERVAL_MS),
  // Offsets and duration refer to the original recording, even after old frames drop.
  durationMs: z.number().nonnegative().max(CLIP_RECORDING_LIFETIME_MS),
  droppedFrames: z.number().int().nonnegative(),
  skippedFrames: z.number().int().nonnegative(),
};
export const clipArtifactSchema = z
  .object({
    version: z.literal(1),
    ...clipMetadata,
    frames: z
      .array(clipFrameSchema)
      .min(1)
      .max(CLIP_MAX_DURATION_MS / CLIP_FRAME_INTERVAL_MS),
  })
  .strict()
  .superRefine((clip, ctx) => {
    const frames = clip.frames;
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
export const clipReadSchema = z
  .object({
    ...clipMetadata,
    state: z.enum(["recording", "stopped"]),
    frameCount: z.number().int().nonnegative().max(150),
    notCaptured: clipNotCapturedReasonSchema.nullable(),
    frames: z
      .array(clipFrameSchema)
      .max(150)
      .refine(
        (frames) =>
          frames.reduce((sum, frame) => sum + frame.data.length, 0) <=
          CLIP_PAGE_BASE64_CHARS,
        "Clip page exceeds its transfer budget.",
      ),
    nextFrame: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type ClipFrame = z.infer<typeof clipFrameSchema>;
export type ClipArtifact = z.infer<typeof clipArtifactSchema>;
export type ClipRead = z.infer<typeof clipReadSchema>;
export type ClipNotCapturedReason = z.infer<typeof clipNotCapturedReasonSchema>;
