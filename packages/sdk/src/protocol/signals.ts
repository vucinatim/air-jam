import { z } from "zod";
import { roomCodeSchema } from "./core";
import { boundedSocketSchema } from "./socket-payload";
export interface PlaySoundPayload {
  id: string;
  volume?: number;
  loop?: boolean;
}

export const signalSchema = boundedSocketSchema(
  z.discriminatedUnion("type", [
    z.object({
      targetId: z.string().min(1).optional(),
      type: z.literal("HAPTIC"),
      payload: z.object({
        pattern: z.enum([
          "light",
          "medium",
          "heavy",
          "success",
          "failure",
          "custom",
        ]),
        sequence: z
          .union([z.number().nonnegative(), z.array(z.number().nonnegative())])
          .optional(),
      }),
    }),
    z.object({
      targetId: z.string().min(1).optional(),
      type: z.literal("TOAST"),
      payload: z.object({
        message: z.string(),
        color: z.string().optional(),
        duration: z.number().nonnegative().optional(),
      }),
    }),
  ]),
  "hostState",
);
export const playSoundEventSchema = boundedSocketSchema(
  z.object({
    roomId: roomCodeSchema,
    targetControllerId: z.string().min(1).optional(),
    soundId: z.string().min(1),
    volume: z.number().min(0).max(1).optional(),
    loop: z.boolean().optional(),
  }),
  "controller",
);

export type SignalPayload = z.infer<typeof signalSchema>;
export type SignalType = SignalPayload["type"];
export type HapticSignalPayload = Extract<
  SignalPayload,
  { type: "HAPTIC" }
>["payload"];
export type ToastSignalPayload = Extract<
  SignalPayload,
  { type: "TOAST" }
>["payload"];
export type PlaySoundEventPayload = z.infer<typeof playSoundEventSchema>;
