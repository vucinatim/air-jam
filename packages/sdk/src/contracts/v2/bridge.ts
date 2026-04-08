import { z } from "zod";

const roomCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(8)
  .regex(/^[A-Z0-9]+$/, {
    message: "room code must contain only A-Z or 0-9",
  });

const runtimeStateSchema = z.enum(["paused", "playing"]);

const playerProfileSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    color: z.string().optional(),
    avatarId: z.string().optional(),
  })
  .strict();

const inputFrameEntrySchema = z
  .object({
    controllerId: z.string().min(1),
    input: z.record(z.string(), z.unknown()),
  })
  .strict();

export const V2_BRIDGE_PARENT_TO_GAME_TYPES = [
  "BOOTSTRAP",
  "PLAYERS_UPDATE",
  "RUNTIME_STATE_UPDATE",
  "INPUT_FRAME",
  "PAUSE",
  "RESUME",
  "SHUTDOWN",
] as const;

export const V2_BRIDGE_GAME_TO_PARENT_TYPES = [
  "READY",
  "STATE_PATCH",
  "SIGNAL",
  "ERROR",
  "METRICS",
] as const;

const allMessageTypes = [
  ...V2_BRIDGE_PARENT_TO_GAME_TYPES,
  ...V2_BRIDGE_GAME_TO_PARENT_TYPES,
] as const;

const knownBridgeMessageTypeSet = new Set<string>(allMessageTypes);

const bootstrapMessageSchema = z
  .object({
    type: z.literal("BOOTSTRAP"),
    payload: z
      .object({
        roomId: roomCodeSchema,
        players: z.array(playerProfileSchema),
        state: z
          .object({
            runtimeState: runtimeStateSchema,
            message: z.string().optional(),
          })
          .strict(),
        capabilities: z.record(z.string(), z.boolean()).default({}),
      })
      .strict(),
  })
  .strict();

const playersUpdateMessageSchema = z
  .object({
    type: z.literal("PLAYERS_UPDATE"),
    payload: z
      .object({
        players: z.array(playerProfileSchema),
      })
      .strict(),
  })
  .strict();

const runtimeStateUpdateMessageSchema = z
  .object({
    type: z.literal("RUNTIME_STATE_UPDATE"),
    payload: z
      .object({
        runtimeState: runtimeStateSchema,
        message: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const inputFrameMessageSchema = z
  .object({
    type: z.literal("INPUT_FRAME"),
    payload: z
      .object({
        frameId: z.number().int().nonnegative(),
        inputs: z.array(inputFrameEntrySchema),
      })
      .strict(),
  })
  .strict();

const pauseMessageSchema = z
  .object({
    type: z.literal("PAUSE"),
    payload: z
      .object({
        reason: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const resumeMessageSchema = z
  .object({
    type: z.literal("RESUME"),
    payload: z.object({}).strict(),
  })
  .strict();

const shutdownMessageSchema = z
  .object({
    type: z.literal("SHUTDOWN"),
    payload: z
      .object({
        reason: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const readyMessageSchema = z
  .object({
    type: z.literal("READY"),
    payload: z
      .object({
        readyAtMs: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const statePatchMessageSchema = z
  .object({
    type: z.literal("STATE_PATCH"),
    payload: z
      .object({
        patch: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

const signalMessageSchema = z
  .object({
    type: z.literal("SIGNAL"),
    payload: z
      .object({
        signalType: z.string().min(1),
        targetId: z.string().min(1).optional(),
        data: z.record(z.string(), z.unknown()),
      })
      .strict(),
  })
  .strict();

const errorMessageSchema = z
  .object({
    type: z.literal("ERROR"),
    payload: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

const metricsMessageSchema = z
  .object({
    type: z.literal("METRICS"),
    payload: z
      .object({
        values: z.record(z.string(), z.number()),
      })
      .strict(),
  })
  .strict();

export const v2BridgeParentToGameMessageSchema = z.union([
  bootstrapMessageSchema,
  playersUpdateMessageSchema,
  runtimeStateUpdateMessageSchema,
  inputFrameMessageSchema,
  pauseMessageSchema,
  resumeMessageSchema,
  shutdownMessageSchema,
]);

export const v2BridgeGameToParentMessageSchema = z.union([
  readyMessageSchema,
  statePatchMessageSchema,
  signalMessageSchema,
  errorMessageSchema,
  metricsMessageSchema,
]);

export const v2BridgeMessageSchema = z.union([
  v2BridgeParentToGameMessageSchema,
  v2BridgeGameToParentMessageSchema,
]);

export type V2BridgeParentToGameMessage = z.infer<
  typeof v2BridgeParentToGameMessageSchema
>;
export type V2BridgeGameToParentMessage = z.infer<
  typeof v2BridgeGameToParentMessageSchema
>;
export type V2BridgeMessage = z.infer<typeof v2BridgeMessageSchema>;

export type UnknownBridgeMessagePolicy = "reject" | "ignore";

export type ParseBridgeMessageResult =
  | { status: "ok"; message: V2BridgeMessage }
  | { status: "ignored_unknown_type" }
  | { status: "invalid"; error: z.ZodError<V2BridgeMessage> };

const isUnknownMessageType = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const messageType = (value as { type?: unknown }).type;
  return (
    typeof messageType === "string" &&
    !knownBridgeMessageTypeSet.has(messageType)
  );
};

export const parseV2BridgeMessage = (
  input: unknown,
  policy: UnknownBridgeMessagePolicy = "reject",
): ParseBridgeMessageResult => {
  if (policy === "ignore" && isUnknownMessageType(input)) {
    return { status: "ignored_unknown_type" };
  }

  const parsed = v2BridgeMessageSchema.safeParse(input);
  if (parsed.success) {
    return { status: "ok", message: parsed.data };
  }

  return { status: "invalid", error: parsed.error };
};
