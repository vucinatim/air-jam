import { z } from "zod";
import { isRpcSerializable } from "../utils/is-rpc-serializable";
import {
  describeAirJamAgentAction,
  resolveAirJamAgentActionPayload,
  type AirJamAgentSnapshotContext,
  type AnyAirJamAgentContract,
} from "./agent-contract";

export const agentActionDescriptorSchema = z.object({
  actionId: z.string().min(1),
  target: z.object({
    kind: z.enum(["participant", "host"]),
    actionName: z.string().min(1),
    storeDomain: z.string().min(1),
  }),
  description: z.string().nullable(),
  availability: z.string().nullable(),
  payload: z.object({
    kind: z.enum(["none", "boolean", "number", "string", "enum", "json"]),
    description: z.string().nullable(),
    allowedValues: z.array(z.string()).optional(),
  }),
  resultDescription: z.string().nullable(),
});

export const agentContractDescriptionSchema = z.object({
  snapshotStoreDomains: z.array(z.string().min(1)),
  snapshotDescription: z.string().nullable(),
  actions: z.array(agentActionDescriptorSchema),
});

export function agentJson<T>(value: T): T {
  if (!isRpcSerializable(value))
    throw new Error("Agent evaluation must return serializable JSON data.");
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

export function createAirJamAgentEvaluator(contract: AnyAirJamAgentContract) {
  return {
    describe() {
      return agentContractDescriptionSchema.parse({
        snapshotStoreDomains: Object.keys(contract.stores),
        snapshotDescription: contract.snapshotDescription ?? null,
        actions: Object.entries(contract.actions).map(([actionId, action]) => {
          const metadata = describeAirJamAgentAction(action);
          return {
            actionId,
            target: {
              ...action.target,
              storeDomain: action.target.storeDomain ?? "default",
            },
            description: metadata.description ?? null,
            availability: action.availability ?? null,
            payload: {
              ...metadata.payload,
              description: metadata.payload.description ?? null,
            },
            resultDescription: metadata.resultDescription ?? null,
          };
        }),
      });
    },
    async project(context: AirJamAgentSnapshotContext) {
      return agentJson(await contract.projectSnapshot(context));
    },
    resolve(actionId: string, input: unknown, gameId: string) {
      const action = contract.actions[actionId];
      if (!action) throw new Error(`Unknown game action "${actionId}".`);
      const payload = agentJson(
        resolveAirJamAgentActionPayload(action, input, {
          gameId,
          actionName: actionId,
          contractKind: "agent",
        }),
      );
      if (
        payload !== undefined &&
        (payload === null ||
          typeof payload !== "object" ||
          Array.isArray(payload))
      )
        throw new Error(
          "Resolved agent action payload must be an object or undefined.",
        );
      return {
        target: {
          ...action.target,
          storeDomain: action.target.storeDomain ?? "default",
        },
        payload: payload as Record<string, unknown> | undefined,
      };
    },
  };
}
