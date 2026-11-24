import { z } from "zod";
import { roomCodeSchema } from "../room-protocol";
import { hostObservationIdentitySchema } from "../runtime/contracts/runtime-identity";
import { airJamActionInvocationResultSchema } from "./actions";

const jsonValueSchema = z
  .unknown()
  .refine(
    (input) => {
      const pending: Array<{ value: unknown; depth: number }> = [
        { value: input, depth: 0 },
      ];
      for (const current of pending) {
        if (current.depth > 32) return false;
        if (current.value && typeof current.value === "object") {
          for (const value of Object.values(current.value)) {
            if (pending.length >= 4096) return false;
            pending.push({ value, depth: current.depth + 1 });
          }
        }
      }
      return true;
    },
    {
      error: "Participant JSON exceeds its depth or node budget.",
      abort: true,
    },
  )
  .pipe(z.json());

export const PARTICIPANT_INPUT_SCHEMA_BYTES = 32_000;
export const participantInputSchemaDescriptionSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({
        status: z.literal("available"),
        schema: z
          .record(z.string(), jsonValueSchema)
          .refine(
            (schema) =>
              new TextEncoder().encode(JSON.stringify(schema)).byteLength <=
              PARTICIPANT_INPUT_SCHEMA_BYTES,
            "Input JSON Schema exceeds its byte budget.",
          ),
      })
      .strict(),
    z
      .object({
        status: z.literal("unavailable"),
        reason: z.enum(["not-configured", "not-representable"]),
      })
      .strict(),
  ],
);

const leaseSequenceSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const PARTICIPANT_CONTROL_DEADLINE_MS = 2000;
const deadlineMs = z
  .number()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER)
  .describe(
    "Admission deadline in the observed host's monotonic clock. Derive it from observation.clock.startedAtMs; never use the caller's clock.",
  );
export const participantInputOperationSchema = z
  .object({
    kind: z.literal("input"),
    deadlineMs,
    input: z.record(z.string(), jsonValueSchema),
    ttlMs: z.number().int().min(50).max(2000),
  })
  .strict();
export const participantReleaseOperationSchema = z
  .object({ kind: z.literal("release") })
  .strict();
export const participantActionOperationSchema = z
  .object({
    kind: z.literal("action"),
    deadlineMs,
    actionId: z.string().min(1).max(128),
    input: jsonValueSchema.optional(),
  })
  .strict();
const operationSchema = z.discriminatedUnion("kind", [
  participantInputOperationSchema,
  participantReleaseOperationSchema,
  participantActionOperationSchema,
]);

/** What an agent's phone asks on the control channel; the room stamps its seat. */
export const leasedControlRequestSchema = z
  .object({
    lease: z.object({ id: z.uuid(), sequence: leaseSequenceSchema }).strict(),
    expected: hostObservationIdentitySchema.strict(),
    operation: operationSchema,
  })
  .strict();
export type LeasedControlRequest = z.infer<typeof leasedControlRequestSchema>;

/** A leased control request as the host applies it: for one seat of one room. */
export const controllerLeasedControlSchema = leasedControlRequestSchema
  .extend({
    roomId: roomCodeSchema,
    controllerId: z.string().min(1).max(128),
  })
  .strict()
  .refine(
    (value) => value.roomId === value.expected.roomId,
    "Participant control must target the observed room.",
  );
export type ControllerLeasedControl = z.infer<
  typeof controllerLeasedControlSchema
>;

export const controllerLeasedControlAckSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("applied"),
      leaseId: z.uuid(),
      sequence: leaseSequenceSchema,
      replayed: z.boolean(),
      operation: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("input") }).strict(),
        z.object({ kind: z.literal("release") }).strict(),
        z
          .object({
            kind: z.literal("action"),
            result: airJamActionInvocationResultSchema,
          })
          .strict(),
      ]),
    })
    .strict(),
  z
    .object({
      status: z.literal("rejected"),
      reason: z.enum([
        "invalid_request",
        "rate_limited",
        "invalid_input",
        "invalid_action",
        "invalid_action_lane",
        "room_not_found",
        "unauthorized",
        "active_host_missing",
        "busy",
        "stale_identity",
        "stale_decision",
        "invalid_deadline",
        "lease_conflict",
        "stale_sequence",
        "sequence_conflict",
        "unsupported",
      ]),
    })
    .strict(),
  z
    .object({
      status: z.literal("unconfirmed"),
      reason: z.enum([
        "host_ack_unavailable",
        "transport_ack_unavailable",
        "runtime_replaced",
        "invalid_acknowledgement",
        "runtime_unavailable",
      ]),
    })
    .strict(),
]);
export type ControllerLeasedControlAck = z.infer<
  typeof controllerLeasedControlAckSchema
>;
