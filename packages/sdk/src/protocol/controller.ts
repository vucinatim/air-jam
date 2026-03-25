import { z } from "zod";
import { roomCodeSchema, type RoomCode } from "./core";
import type { ErrorCode } from "./errors";

export const controllerInputSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
  input: z.record(z.string(), z.unknown()),
});

export type ControllerInputPayload = Record<string, unknown>;

export interface ControllerInputEvent {
  roomId: RoomCode;
  controllerId: string;
  input: ControllerInputPayload;
}

export const controllerOrientationSchema = z.enum(["portrait", "landscape"]);

export type ControllerOrientation = z.infer<typeof controllerOrientationSchema>;

export const controllerStateSchema = z.object({
  roomId: roomCodeSchema,
  state: z.object({
    orientation: controllerOrientationSchema.optional(),
    message: z.string().optional(),
    gameState: z.enum(["paused", "playing"]).optional(),
  }),
});

export type ControllerStateMessage = z.infer<typeof controllerStateSchema>;

export type ControllerStatePayload = z.infer<
  typeof controllerStateSchema
>["state"];

export const controllerJoinSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
  nickname: z.string().trim().min(1).max(24).optional(),
  /** Preset avatar key (platform-defined); optional at join. */
  avatarId: z.string().trim().min(1).max(48).optional(),
});

export type ControllerJoinPayload = z.infer<typeof controllerJoinSchema>;

export const controllerLeaveSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
});

export type ControllerLeavePayload = z.infer<typeof controllerLeaveSchema>;

export const controllerSystemSchema = z.object({
  roomId: roomCodeSchema,
  command: z.enum(["exit", "ready", "toggle_pause"]),
});

export type ControllerSystemPayload = z.infer<typeof controllerSystemSchema>;

export interface PlayerProfile {
  id: string;
  label: string;
  color?: string;
  /** Preset avatar id chosen by the player (platform resolves to artwork). */
  avatarId?: string;
}

export const playerProfilePatchSchema = z
  .object({
    label: z.string().trim().min(1).max(24).optional(),
    avatarId: z.string().trim().min(1).max(48).optional(),
  })
  .strict();

export type PlayerProfilePatch = z.infer<typeof playerProfilePatchSchema>;

export const controllerUpdatePlayerProfileSchema = z
  .object({
    roomId: roomCodeSchema,
    controllerId: z.string().min(3),
    patch: playerProfilePatchSchema,
  })
  .refine(
    (data) =>
      data.patch.label !== undefined || data.patch.avatarId !== undefined,
    { message: "patch must include at least one field" },
  );

export type ControllerUpdatePlayerProfilePayload = z.infer<
  typeof controllerUpdatePlayerProfileSchema
>;

export interface ControllerUpdatePlayerProfileAck {
  ok: boolean;
  message?: string;
  player?: PlayerProfile;
  code?: ErrorCode | string;
}

export interface ControllerJoinAck {
  ok: boolean;
  controllerId?: string;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
}
