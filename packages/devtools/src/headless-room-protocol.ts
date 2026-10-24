import {
  hostAgentRequestSchema,
  hostAgentResponseSchema,
} from "@air-jam/sdk/runtime-control";
import { z } from "zod";

export const HEADLESS_ROOM_IPC_MAX_BYTES = 1_000_000;
/** The longest stretch of game time one request may advance. */
export const HEADLESS_ROOM_MAX_ADVANCE_MS = 60_000;

export const headlessRoomRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("initialize"),
      id: z.uuid(),
      configPath: z.string().min(1),
      seed: z.number().int().min(0).max(0xffff_ffff),
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent"),
      id: z.uuid(),
      request: hostAgentRequestSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("advance"),
      id: z.uuid(),
      ms: z.number().positive().max(HEADLESS_ROOM_MAX_ADVANCE_MS),
    })
    .strict(),
  z
    .object({
      kind: z.literal("saveInputLog"),
      id: z.uuid(),
      /** Where the room writes its input log. */
      path: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("replay"),
      id: z.uuid(),
      configPath: z.string().min(1),
      /** An input log this game recorded; the room plays it with no server. */
      logPath: z.string().min(1),
    })
    .strict(),
]);
export type HeadlessRoomRequest = z.infer<typeof headlessRoomRequestSchema>;

export const headlessRoomResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }).strict(),
  z
    .object({
      kind: z.literal("initialized"),
      id: z.uuid(),
      gameId: z.string().nullable(),
      roomId: z.string().min(1),
      controllerJoinUrl: z.url(),
      nowMs: z.number().nonnegative(),
      /** Whether the room keeps an input log: its game declares a simulation. */
      recordsInputLog: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent"),
      id: z.uuid(),
      response: hostAgentResponseSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("advanced"),
      id: z.uuid(),
      nowMs: z.number().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("savedInputLog"),
      id: z.uuid(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      ticks: z.number().int().nonnegative(),
      entries: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("replayed"),
      id: z.uuid(),
      gameId: z.string().nullable(),
      roomId: z.string().min(1),
      ticks: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("error"),
      id: z.uuid(),
      message: z.string().max(2000),
    })
    .strict(),
]);
export type HeadlessRoomResponse = z.infer<typeof headlessRoomResponseSchema>;
