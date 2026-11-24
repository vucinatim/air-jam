import { z } from "zod";

/**
 * What the SDK itself carries on a room, beside a game's own channels: the
 * room's presentation, agents' leased control and the one-shot signals
 * phones act on. Another engine that wants SDK phones and hosts to work with
 * it speaks these names and shapes.
 */

/** The presentation channel's name when the host is a game; a launcher uses its own. */
export const AIRJAM_PRESENTATION_CHANNEL = "airjam.room";

export const runtimeStateSchema = z.enum(["paused", "playing"]);
export type RuntimeState = z.infer<typeof runtimeStateSchema>;

export const controllerOrientationSchema = z.enum(["portrait", "landscape"]);
export type ControllerOrientation = z.infer<typeof controllerOrientationSchema>;

/** Whether play runs and how phones hold themselves; the host alone writes it. */
export const presentationDocumentSchema = z.object({
  runtimeState: runtimeStateSchema,
  orientation: controllerOrientationSchema,
});
export type PresentationDocument = z.infer<typeof presentationDocumentSchema>;

/** Requests a phone makes on the presentation channel; the host answers `{ runtimeState }`. */
export const presentationRequestSchema = z.enum(["pause", "resume"]);
export type PresentationRequest = z.infer<typeof presentationRequestSchema>;

/** Agents' leased control of a seat travels as exclusive requests on this channel. */
export const AIRJAM_CONTROL_CHANNEL = "airjam.control";
export const AIRJAM_LEASED_CONTROL_REQUEST = "lease";

export const hapticSignalPayloadSchema = z.object({
  pattern: z.enum(["light", "medium", "heavy", "success", "failure", "custom"]),
  sequence: z
    .union([z.number().nonnegative(), z.array(z.number().nonnegative())])
    .optional(),
});
export type HapticSignalPayload = z.infer<typeof hapticSignalPayloadSchema>;

export const toastSignalPayloadSchema = z.object({
  message: z.string(),
  color: z.string().optional(),
  duration: z.number().nonnegative().optional(),
});
export type ToastSignalPayload = z.infer<typeof toastSignalPayloadSchema>;

export const soundSignalPayloadSchema = z.object({
  soundId: z.string().min(1),
  volume: z.number().min(0).max(1).optional(),
  loop: z.boolean().optional(),
});
export type SoundSignalPayload = z.infer<typeof soundSignalPayloadSchema>;

/** The signal kinds phones act on, each with its payload. */
export const airJamSignalSchemas = {
  haptic: hapticSignalPayloadSchema,
  toast: toastSignalPayloadSchema,
  sound: soundSignalPayloadSchema,
} as const;
export type AirJamSignalKind = keyof typeof airJamSignalSchemas;
export type AirJamSignal = {
  [Kind in AirJamSignalKind]: {
    readonly kind: Kind;
    readonly payload: z.infer<(typeof airJamSignalSchemas)[Kind]>;
  };
}[AirJamSignalKind];

/** A signal a phone received, or null when it is not one the SDK knows. */
export const parseAirJamSignal = (signal: {
  readonly kind: string;
  readonly payload: unknown;
}): AirJamSignal | null => {
  if (!Object.hasOwn(airJamSignalSchemas, signal.kind)) return null;
  const kind = signal.kind as AirJamSignalKind;
  const parsed = airJamSignalSchemas[kind].safeParse(signal.payload);
  return parsed.success
    ? ({ kind, payload: parsed.data } as AirJamSignal)
    : null;
};
