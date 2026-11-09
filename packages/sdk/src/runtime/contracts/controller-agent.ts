import { z } from "zod";
import { hostObservationImageSchema } from "./observation";

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
export const controllerAgentRequestMessageSchema = z
  .object({
    type: z.literal("AIRJAM_CONTROLLER_AGENT"),
    requestId: z.string().min(1).max(128),
    request: z
      .object({
        operation: z.literal("capture"),
        roomId: z.string().min(1).max(8),
        controllerId: z.string().min(1).max(128),
      })
      .strict(),
  })
  .strict();
export const controllerAgentResultMessageSchema = z
  .object({
    type: z.literal("AIRJAM_CONTROLLER_AGENT_RESULT"),
    requestId: controllerAgentRequestMessageSchema.shape.requestId,
    roomId: z.string().min(1).max(8),
    controllerId: z.string().min(1).max(128),
    capture: controllerCaptureSchema,
  })
  .strict();
