import { airJamSettingsValuesSchema } from "@air-jam/sdk/core";
import { controllerLeasedControlSchema } from "@air-jam/sdk/protocol";
import { hostObservationRequestSchema } from "@air-jam/sdk/runtime-control";
import { z } from "zod";
import {
  currentRoomAttachmentSchema,
  gameRunAddressSchema,
  gameRunDiscoverySchema,
  gameRunSteerSchema,
  gameRunWaitSchema,
  startGameRunSchema,
} from "./game-run-protocol.js";
import { gameRunWatchRequestSchema } from "./game-run-watch.js";

const timeoutMs = z.number().int().positive().max(120_000).optional();
const scope = { cwd: z.string().min(1).optional() };
const session = z.object({ ...scope, gameSessionId: z.uuid() }).strict();

export const gameSessionOperationSchemas = {
  open: z
    .object({
      ...scope,
      gameId: z.string().min(1).optional(),
      mode: z.enum(["standalone-dev", "arcade-dev", "arcade-test"]).optional(),
      secure: z.boolean().optional(),
      roomId: z.string().min(1).optional(),
      controllerJoinUrl: z.url().optional(),
      controllerId: z.string().min(3).optional(),
      deviceId: z.string().min(8).optional(),
      nickname: z.string().min(1).optional(),
      avatarId: z.string().min(1).optional(),
      capabilityToken: z.string().min(1).optional(),
      timeoutMs,
    })
    .strict(),
  read: session.extend({ timeoutMs }),
  observe: session.extend({
    timeoutMs,
    ...hostObservationRequestSchema
      .omit({ roomId: true, controllerId: true })
      .partial().shape,
  }),
  "settings-read": session.extend({ timeoutMs }),
  "settings-update": session.extend({
    timeoutMs,
    patch: airJamSettingsValuesSchema,
    expectedRevision: z.number().int().nonnegative(),
  }),
  control: session.extend({
    lease: controllerLeasedControlSchema.shape.lease,
    expected: controllerLeasedControlSchema.shape.expected,
    operation: controllerLeasedControlSchema.shape.operation,
  }),
  input: session.extend({ input: z.record(z.string(), z.json()) }),
  invoke: session.extend({
    actionId: z.string().min(1),
    payload: z.json().optional(),
    timeoutMs,
  }),
  capture: session.extend({ timeoutMs }),
  close: session,
};

export const gameSessionBrokerRequestSchema = z.discriminatedUnion(
  "operation",
  [
    z
      .object({
        operation: z.literal("run.start"),
        input: startGameRunSchema,
        attachment: currentRoomAttachmentSchema.optional(),
      })
      .strict(),
    z
      .object({ operation: z.literal("run.read"), input: gameRunAddressSchema })
      .strict(),
    z
      .object({ operation: z.literal("run.wait"), input: gameRunWaitSchema })
      .strict(),
    z
      .object({ operation: z.literal("run.stop"), input: gameRunAddressSchema })
      .strict(),
    z
      .object({ operation: z.literal("run.steer"), input: gameRunSteerSchema })
      .strict(),
    z
      .object({
        operation: z.literal("run.cancel"),
        input: gameRunAddressSchema,
      })
      .strict(),
    z
      .object({
        operation: z.literal("run.list"),
        input: gameRunDiscoverySchema.pick({ cwd: true }),
      })
      .strict(),
    z
      .object({
        operation: z.literal("run.stop-all"),
        input: gameRunDiscoverySchema.pick({ cwd: true }),
      })
      .strict(),
    z
      .object({
        operation: z.literal("run.profiles"),
        input: gameRunDiscoverySchema,
      })
      .strict(),
    z
      .object({
        operation: z.literal("run.watch"),
        input: gameRunWatchRequestSchema,
      })
      .strict(),
    z.object({ operation: z.literal("health") }).strict(),
    z
      .object({
        operation: z.literal("open"),
        input: gameSessionOperationSchemas.open,
      })
      .strict(),
    z
      .object({
        operation: z.literal("read"),
        input: gameSessionOperationSchemas.read,
      })
      .strict(),
    z
      .object({
        operation: z.literal("observe"),
        input: gameSessionOperationSchemas.observe,
      })
      .strict(),
    z
      .object({
        operation: z.literal("control"),
        input: gameSessionOperationSchemas.control,
      })
      .strict(),
    z
      .object({
        operation: z.literal("input"),
        input: gameSessionOperationSchemas.input,
      })
      .strict(),
    z
      .object({
        operation: z.literal("invoke"),
        input: gameSessionOperationSchemas.invoke,
      })
      .strict(),
    z
      .object({
        operation: z.literal("capture"),
        input: gameSessionOperationSchemas.capture,
      })
      .strict(),
    z
      .object({
        operation: z.literal("close"),
        input: gameSessionOperationSchemas.close,
      })
      .strict(),
    z
      .object({
        operation: z.literal("settings-read"),
        input: gameSessionOperationSchemas["settings-read"],
      })
      .strict(),
    z
      .object({
        operation: z.literal("settings-update"),
        input: gameSessionOperationSchemas["settings-update"],
      })
      .strict(),
    z.object({ operation: z.literal("shutdown") }).strict(),
  ],
);

export type GameSessionBrokerRequest = z.infer<
  typeof gameSessionBrokerRequestSchema
>;
