import { z } from "zod";
import { hostObservationImageSchema } from "./observation";

/** Includes the phone paint and cross-frame transfer. */
export const CONTROLLER_CAPTURE_TIMEOUT_MS = 10_000;

export const controllerCaptureSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("captured"),
      image: hostObservationImageSchema
        .extend({
          mimeType: z.literal("image/jpeg"),
          width: z.number().int().positive().max(1280),
          height: z.number().int().positive().max(1280),
          coverage: z.literal("controller-view"),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      status: z.literal("unavailable"),
      reason: z.enum(["unsupported", "surface-unavailable", "timeout"]),
      detail: z.string().max(1024).optional(),
    })
    .strict(),
]);
export type ControllerCapture = z.infer<typeof controllerCaptureSchema>;
export const controllerFrameCaptureSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("captured"),
      bitmap: z.custom<ImageBitmap>(
        (value) =>
          typeof ImageBitmap !== "undefined" &&
          value instanceof ImageBitmap &&
          value.width > 0 &&
          value.height > 0 &&
          value.width <= 1280 &&
          value.height <= 1280,
      ),
    })
    .strict(),
  controllerCaptureSchema.options[1],
]);
export type ControllerFrameCapture = z.infer<
  typeof controllerFrameCaptureSchema
>;
export const controllerPressActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("tap"),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("hold"),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      durationMs: z.number().int().min(100).max(5000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("type"),
      text: z.string().min(1).max(500),
      submit: z.boolean().optional(),
    })
    .strict(),
]);
export type ControllerPressAction = z.infer<typeof controllerPressActionSchema>;
export const controllerPressResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("done"),
      target: z
        .object({
          tag: z.string(),
          role: z.string().optional(),
          label: z.string().max(120).optional(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      status: z.literal("missed"),
      reason: z.enum(["no-target", "not-editable", "busy"]),
    })
    .strict(),
]);
export type ControllerPressResult = z.infer<typeof controllerPressResultSchema>;
const controllerAgentIdentitySchema = z.object({
  roomId: z.string().min(1).max(8),
  controllerId: z.string().min(1).max(128),
});
export const controllerAgentRequestMessageSchema = z
  .object({
    type: z.literal("AIRJAM_CONTROLLER_AGENT"),
    requestId: z.string().min(1).max(128),
    request: z.discriminatedUnion("operation", [
      controllerAgentIdentitySchema
        .extend({ operation: z.literal("capture") })
        .strict(),
      controllerAgentIdentitySchema
        .extend({
          operation: z.literal("press"),
          action: controllerPressActionSchema,
        })
        .strict(),
    ]),
  })
  .strict();
export const controllerAgentResultMessageSchema = z
  .object({
    type: z.literal("AIRJAM_CONTROLLER_AGENT_RESULT"),
    requestId: controllerAgentRequestMessageSchema.shape.requestId,
    roomId: z.string().min(1).max(8),
    controllerId: z.string().min(1).max(128),
    capture: controllerFrameCaptureSchema,
    press: controllerPressResultSchema.optional(),
  })
  .strict();

export type ControllerAgentRequest = z.infer<
  typeof controllerAgentRequestMessageSchema
>["request"];
