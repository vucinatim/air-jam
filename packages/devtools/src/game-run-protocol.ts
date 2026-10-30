import { controllerLeasedControlAckSchema } from "@air-jam/sdk/protocol";
import {
  hostAgentRequestSchema,
  hostObservationIdentitySchema,
  hostRuntimeFaultSchema,
} from "@air-jam/sdk/runtime-control";
import { z } from "zod";
import { controllerDisconnectionSchema } from "./controller-protocol.js";
import { gameBuildIdentitySchema } from "./game-build-protocol.js";
import { policyArtifactReceiptSchema } from "./policy-artifact-contract.js";
import {
  airJamScenarioVerdictSchema,
  airJamTestProfileDescriptionSchema,
  policyPreparationSchema,
} from "./testing.js";
export const GAME_RUN_PROTOCOL_VERSION = 5;
export const MAXIMUM_GAME_RUN_BUILD_LOG_BYTES = 1_048_576;
export const gameRunBuildLogSchema = z.object({
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative().max(MAXIMUM_GAME_RUN_BUILD_LOG_BYTES),
  truncated: z.boolean(),
});
export type AirJamGameRunBuildLog = z.infer<typeof gameRunBuildLogSchema>;
export const MAXIMUM_GAME_RUN_MS = 600_000;
export const MAXIMUM_GAME_RUN_TRACE_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_GAME_RUN_STEERING_CHANGES = 64;
export const GAME_SESSION_BROKER_STATE_FILE =
  ".airjam/devtools/game-session-broker.json";
const attachmentUrlSchema = z
  .url()
  .max(4096)
  .refine((value) => {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "An attachment requires an HTTP(S) URL without embedded credentials.");
/** The most players one run can seat in a creator's room. */
export const MAXIMUM_CURRENT_ROOM_SEATS = 8;
export const currentRoomAttachmentSchema = z
  .object({
    controllerJoinUrl: attachmentUrlSchema.refine(
      (value) => Boolean(new URL(value).searchParams.get("room")),
      "A controller attachment requires a room.",
    ),
    /** One controller identity per seat, issued by the room's editor. */
    controllerIds: z
      .array(z.string().min(3).max(64))
      .min(1)
      .max(MAXIMUM_CURRENT_ROOM_SEATS)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Seat controller identities must be distinct.",
      ),
    host: z
      .object({
        endpoint: attachmentUrlSchema,
        targetId: z.string().min(1).max(128),
      })
      .strict(),
  })
  .strict();
export type CurrentRoomAttachment = z.infer<typeof currentRoomAttachmentSchema>;
/** A request to the creator's host, answered through the editor that granted the room. */
export const currentRoomHostRequestSchema = z
  .object({
    targetId: currentRoomAttachmentSchema.shape.host.shape.targetId,
    ownerInstanceId: z.uuid(),
    request: hostAgentRequestSchema,
  })
  .strict();

/** What a seat is trying to do, in words its decision model reads. */
export const seatIntentSchema = z.string().trim().min(1).max(500);
export const steeringSourceSchema = z.enum(["creator", "agent", "operator"]);

export const startGameRunSchema = z
  .object({
    cwd: z.string().min(1).optional(),
    runId: z.uuid(),
    gameId: z.string().min(1).optional(),
    target: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("owned") }).strict(),
      z.object({ kind: z.literal("current") }).strict(),
      /** Plays in a room with no page, on game time, as fast as the host runs. */
      z.object({ kind: z.literal("headless") }).strict(),
    ]),
    profileId: z.string().min(1).max(64),
    policyId: z.string().min(1).max(64),
    seed: z.number().int().min(0).max(0xffff_ffff).default(0),
    budget: z
      .object({
        durationMs: z.number().int().min(1000).max(MAXIMUM_GAME_RUN_MS),
        steps: z.number().int().min(1).max(10_000),
      })
      .strict(),
    intents: z.record(z.string().min(1).max(64), seatIntentSchema).optional(),
  })
  .strict();
export type StartGameRunOptions = z.input<typeof startGameRunSchema>;
export const gameRunAddressSchema = z
  .object({ cwd: z.string().min(1).optional(), runId: z.uuid() })
  .strict();
export const gameRunSteerSchema = gameRunAddressSchema
  .extend({
    seatId: z.string().min(1).max(64),
    intent: seatIntentSchema.nullable(),
    source: steeringSourceSchema.default("operator"),
  })
  .strict();
export type GameRunSteerOptions = z.input<typeof gameRunSteerSchema>;
export const gameRunWaitSchema = gameRunAddressSchema.extend({
  timeoutMs: z.number().int().min(1).max(30_000).default(25_000),
});
export const gameRunDiscoverySchema = z
  .object({
    cwd: z.string().min(1).optional(),
    gameId: z.string().min(1).optional(),
  })
  .strict();

export const gameRunEndReasonSchema = z.enum([
  "completed",
  "failed",
  "budget",
  "stopped",
  "owner_stopping",
  "owner_lost",
  "session_expired",
  "runtime_replaced",
  "policy_unresponsive",
  "decision_latency",
  "host_not_advancing",
  "seat_replaced",
  "untested_seat",
  "evaluator_unresponsive",
  "trace_budget",
  "error",
]);
export const gameRunSessionIdentitySchema = z.object({
  gameSessionId: z.uuid(),
  gameId: z.string().nullable(),
  roomId: z.string().min(1),
  controllerId: z.string().min(1),
  semanticAccess: z.enum(["owned-host", "delegated-host", "participant-only"]),
  connected: z.boolean(),
});
export const gameRunRecordSchema = z
  .object({
    version: z.literal(1),
    runId: z.uuid(),
    ownerInstanceId: z.uuid(),
    request: startGameRunSchema,
    state: z.enum(["starting", "setup", "playing", "stopping", "ended"]),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().optional(),
    watched: z.literal(true).optional(),
    profile: airJamTestProfileDescriptionSchema.optional(),
    policyPreparation: policyPreparationSchema.optional(),
    policyInitializationMs: z.number().finite().nonnegative().optional(),
    policyArtifacts: policyArtifactReceiptSchema.optional(),
    decisionModel: z.string().min(1).max(200).optional(),
    build: gameBuildIdentitySchema
      .extend({ integrity: z.enum(["sealed", "verified", "changed"]) })
      .optional(),
    session: gameRunSessionIdentitySchema.optional(),
    expected: hostObservationIdentitySchema.optional(),
    seats: z
      .array(
        z
          .object({
            seatId: z.string(),
            controllerId: z.string(),
            expected: hostObservationIdentitySchema.optional(),
            counters: z
              .object({
                decisions: z.number().int().nonnegative(),
                applied: z.number().int().nonnegative(),
                rejected: z.number().int().nonnegative(),
                unconfirmed: z.number().int().nonnegative(),
                timeout: z.number().int().nonnegative(),
                blocked: z.number().int().nonnegative(),
                effects: z.number().int().nonnegative(),
              })
              .strict(),
            intent: seatIntentSchema.nullable().default(null),
            answers: z
              .object({
                asked: z.number().int().nonnegative(),
                answered: z.number().int().nonnegative(),
                missed: z.number().int().nonnegative(),
                lowConfidence: z.number().int().nonnegative(),
                lowConfidenceStretches: z.number().int().nonnegative(),
                choices: z.record(z.string(), z.number().int().nonnegative()),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .max(8)
      .default([]),
    /** The host's frame rate and simulation speed during play (1 = real time). */
    hostPace: z
      .object({
        framesPerSecond: z.number().nonnegative(),
        simulationSpeed: z.number().nonnegative(),
      })
      .strict()
      .optional(),
    steering: z
      .array(
        z
          .object({
            at: z.iso.datetime(),
            seatId: z.string(),
            intent: seatIntentSchema.nullable(),
            source: steeringSourceSchema,
          })
          .strict(),
      )
      .max(MAXIMUM_GAME_RUN_STEERING_CHANGES)
      .optional(),
    evaluation: z
      .object({
        play: airJamScenarioVerdictSchema.optional(),
        final: airJamScenarioVerdictSchema.optional(),
      })
      .strict()
      .optional(),
    counters: z
      .object({
        steps: z.number().int().nonnegative(),
        applied: z.number().int().nonnegative(),
        rejected: z.number().int().nonnegative(),
        unconfirmed: z.number().int().nonnegative(),
        missed: z.number().int().nonnegative(),
      })
      .strict(),
    end: z
      .object({
        reason: gameRunEndReasonSchema,
        outcome: z.enum(["passed", "failed", "inconclusive"]),
        message: z.string(),
        hostFault: hostRuntimeFaultSchema.optional(),
      })
      .strict()
      .optional(),
    cleanup: z
      .object({
        participantsClosed: z.boolean(),
        processesClosed: z.boolean().optional(),
        seats: z
          .array(
            z
              .object({
                seatId: z.string(),
                release: controllerLeasedControlAckSchema.optional(),
                disconnection: controllerDisconnectionSchema.optional(),
              })
              .strict(),
          )
          .max(8),
        close: z
          .object({
            closed: z.boolean(),
            disconnection: controllerDisconnectionSchema,
          })
          .strict()
          .optional(),
        forced: z.literal(true).optional(),
        errors: z.array(z.string()),
      })
      .strict()
      .optional(),
    evidence: z
      .object({
        buildLog: gameRunBuildLogSchema.optional(),
        trace: z
          .object({
            path: z.string().min(1),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            bytes: z
              .number()
              .int()
              .nonnegative()
              .max(MAXIMUM_GAME_RUN_TRACE_BYTES),
            truncated: z.boolean(),
          })
          .strict()
          .optional(),
        observation: z
          .object({
            path: z.string().min(1),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict()
          .nullable(),
        /** A headless run's input log, which replays the match. */
        inputLog: z
          .object({
            path: z.string().min(1),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            ticks: z.number().int().nonnegative(),
            entries: z.number().int().nonnegative(),
          })
          .strict()
          .optional(),
        error: z.string().nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type AirJamGameRunRecord = z.infer<typeof gameRunRecordSchema>;
export const gameRunCancellationSchema = z
  .object({
    runId: z.uuid(),
    ownerInstanceId: z.uuid(),
    fenced: z.literal(true),
    record: gameRunRecordSchema.nullable(),
  })
  .strict();
export type AirJamGameRunCancellation = z.infer<
  typeof gameRunCancellationSchema
>;

export {
  formatGameRunWatchSurface,
  GAME_WATCH_HEARTBEAT_MS,
  gameRunWatchEventSchema,
  gameRunWatchRequestSchema,
  gameRunWatchSurfaceSchema,
  GameRunWatchWriter,
  MAXIMUM_GAME_WATCH_FRAME_BASE64,
  parseGameRunWatchSurface,
  readGameRunWatchStream,
} from "./game-run-watch.js";
export type {
  GameRunWatchEvent,
  GameRunWatchSurface,
} from "./game-run-watch.js";
