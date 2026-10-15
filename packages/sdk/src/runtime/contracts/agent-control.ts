import { z } from "zod";
import { agentContractDescriptionSchema } from "../../agent/agent-evaluator";
import { roomCodeSchema } from "../../protocol/core";
import { airJamActionInvocationResultSchema } from "../../protocol/sync";
import { isRpcSerializable } from "../../utils/is-rpc-serializable";

const identity = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(1),
});
const actionRequest = identity.extend({
  contractId: z.string().min(1),
  runtimeId: z.string().min(1),
  actionId: z.string().min(1),
  payload: z
    .unknown()
    .refine(
      (value) => isRpcSerializable(value),
      "Agent input must be serializable JSON data.",
    )
    .optional(),
});
export const hostAgentRequestSchema = z.discriminatedUnion("operation", [
  identity.extend({ operation: z.literal("read") }).strict(),
  actionRequest.extend({ operation: z.literal("resolve") }).strict(),
  actionRequest.extend({ operation: z.literal("invoke-host") }).strict(),
]);

export const hostAgentSnapshotSchema = agentContractDescriptionSchema.extend({
  contractId: z.string().min(1),
  runtimeId: z.string().min(1),
  snapshot: z.record(z.string(), z.unknown()),
  rawStores: z.array(
    z.object({
      storeDomain: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
      revision: z.number().int().nonnegative(),
      updatedAt: z.string(),
    }),
  ),
  storeDomainBindings: z.array(
    z.object({
      contractStoreDomain: z.string(),
      runtimeStoreDomain: z.string(),
    }),
  ),
});

export const hostAgentResponseSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("read"),
    snapshot: hostAgentSnapshotSchema.nullable(),
  }),
  z.object({
    operation: z.enum(["resolve", "invoke-host"]),
    target: z.object({
      kind: z.enum(["participant", "host"]),
      actionName: z.string(),
      storeDomain: z.string(),
    }),
    payload: z.record(z.string(), z.unknown()).optional(),
    acknowledgement: airJamActionInvocationResultSchema.optional(),
  }),
]);
export type HostAgentRequest = z.infer<typeof hostAgentRequestSchema>;
export type HostAgentResponse = z.infer<typeof hostAgentResponseSchema>;
