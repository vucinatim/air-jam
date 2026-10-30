import { z } from "zod";
import { agentActionDescriptorSchema } from "../../agent/agent-evaluator";
import {
  connectionStatusSchema,
  roomCodeSchema,
  runtimeStateSchema,
} from "../../protocol/core";
import { participantInputSchemaDescriptionSchema } from "../../protocol/leased-control";
import { isRpcSerializable } from "../../utils/is-rpc-serializable";
import { hostObservationIdentitySchema } from "./runtime-identity";
export { hostObservationIdentitySchema };

export const HOST_OBSERVATION_IMAGE_BYTES = 640_000;
export const HOST_OBSERVATION_TIMEOUT_MS = 3_000;

const jsonObject = z
  .record(z.string(), z.unknown())
  .refine(
    (value) =>
      isRpcSerializable(value) &&
      new TextEncoder().encode(JSON.stringify(value)).byteLength <= 128_000,
    {
      message:
        "Observations require serializable JSON within the 128 KB state budget.",
    },
  );

export const hostObservationRequestSchema = z
  .object({
    roomId: roomCodeSchema,
    controllerId: z.string().min(1).max(128).nullable(),
    scope: z.enum(["player", "diagnostic"]),
    includeImage: z.boolean(),
    expected: hostObservationIdentitySchema.optional(),
  })
  .strict();

export const hostObservationImageSchema = z
  .object({
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    data: z
      .string()
      .min(4)
      .max(Math.ceil(HOST_OBSERVATION_IMAGE_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/)
      .refine(
        (value) =>
          value.length % 4 === 0 &&
          (value.length / 4) * 3 -
            (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0) <=
            HOST_OBSERVATION_IMAGE_BYTES,
        "Observation image exceeds its byte budget or is invalid base64.",
      ),
    width: z.number().int().positive().max(4096),
    height: z.number().int().positive().max(4096),
    coverage: z.enum(["render-surface", "host-document", "controller-view"]),
  })
  .strict();

const storeRevision = z.object({
  storeDomain: z.string().min(1),
  revision: z.number().int().nonnegative(),
});

export const hostRuntimeFaultSchema = z
  .object({
    name: z.string().max(128),
    message: z.string().max(2048),
    source: z
      .object({
        file: z.string().max(2048),
        line: z.number().int().positive(),
        column: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    stack: z.string().max(8192),
  })
  .strict();
export type HostRuntimeFault = z.infer<typeof hostRuntimeFaultSchema>;

export const hostObservationPresentationSchema = z
  .object({
    runtimeState: runtimeStateSchema,
    connectionStatus: connectionStatusSchema,
    fault: hostRuntimeFaultSchema.nullable().optional(),
  })
  .strict();

export const hostObservationClockSchema = z
  .object({
    startedAtMs: z.number().nonnegative(),
    finishedAtMs: z.number().nonnegative(),
  })
  .strict()
  .refine(
    (value) => value.finishedAtMs >= value.startedAtMs,
    "The host clock must advance monotonically.",
  );

export const hostObservationSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  identity: hostObservationIdentitySchema,
  sequence: z.number().int().positive(),
  scope: z.enum(["player", "diagnostic"]),
  controllerId: z.string().nullable(),
  host: z
    .object({
      before: hostObservationPresentationSchema.nullable(),
      after: hostObservationPresentationSchema.nullable(),
    })
    .optional(),
  actions: z.array(agentActionDescriptorSchema).optional(),
  capabilities: z
    .object({
      participantControl: z
        .object({
          input: z.literal(1).optional(),
          inputSchema: participantInputSchemaDescriptionSchema.optional(),
          actions: z.literal(1).optional(),
        })
        .optional(),
    })
    .optional(),
  capturedAt: z.iso.datetime(),
  clock: hostObservationClockSchema.optional(),
  /** The page's slowest fixed-step simulation against real time, since it started. */
  pace: z
    .object({
      frames: z.number().int().nonnegative(),
      wallMs: z.number().nonnegative(),
      simulatedMs: z.number().nonnegative(),
    })
    .strict()
    .optional(),
  durationMs: z.number().nonnegative(),
  snapshot: jsonObject,
  runtime: jsonObject.nullable(),
  ticks: z.object({
    before: z.number().int().nonnegative().nullable(),
    after: z.number().int().nonnegative().nullable(),
  }),
  stores: z.object({
    before: z.array(storeRevision),
    after: z.array(storeRevision),
  }),
  visual: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("captured"),
      image: hostObservationImageSchema,
    }),
    z.object({
      status: z.literal("unavailable"),
      reason: z.enum(["not-requested", "unsupported", "surface-unavailable"]),
    }),
  ]),
});

export type HostObservation = z.infer<typeof hostObservationSchema>;
export type HostObservationRequest = z.infer<
  typeof hostObservationRequestSchema
>;
export type HostObservationImage = z.infer<typeof hostObservationImageSchema>;
export type HostObservationContext = Pick<
  HostObservationRequest,
  "controllerId" | "scope"
>;

export type HostObservationSurface = {
  read: (context: HostObservationContext) => {
    state: Record<string, unknown>;
    /** Publish while this simulation clock is expected to advance; omit for a stationary or event-driven surface. */
    tick?: number;
  };
  capture?: () =>
    | HostObservationImage
    | null
    | Promise<HostObservationImage | null>;
};
