import { hostObservationSchema } from "@air-jam/sdk/runtime-control";
import { z } from "zod";
import { seatIntentSchema } from "./game-run-protocol.js";
import { policyArtifactReceiptSchema } from "./policy-artifact-contract.js";
import {
  airJamPolicyDecisionSchema,
  airJamRunReceiptSchema,
  airJamScenarioVerdictSchema,
  airJamTestProfileDescriptionSchema,
  policyPreparationSchema,
} from "./testing.js";

const step = z
  .object({
    observation: hostObservationSchema,
    seatId: z.string(),
    intent: seatIntentSchema.nullable(),
    step: z.number().int().nonnegative(),
    elapsedMs: z.number().nonnegative(),
    receipts: z.array(airJamRunReceiptSchema).max(128),
  })
  .strict();
export const testProfileRequestSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("initialize"),
      id: z.uuid(),
      rootDir: z.string().min(1),
      configPath: z.string().min(1),
      role: z.enum(["discover", "policy", "evaluator"]),
      artifacts: z
        .object({
          directory: z.string().min(1),
          receipt: policyArtifactReceiptSchema,
        })
        .strict()
        .optional(),
      profileId: z.string().optional(),
      policyId: z.string().optional(),
      seed: z.number().int().min(0).max(0xffff_ffff),
    })
    .strict(),
  z.object({ kind: z.literal("decide"), id: z.uuid(), step }).strict(),
  z
    .object({
      kind: z.literal("evaluate"),
      id: z.uuid(),
      sample: z
        .object({
          phase: z.enum(["play", "final"]),
          observation: hostObservationSchema,
          seats: z
            .array(
              z
                .object({ seatId: z.string(), controllerId: z.string() })
                .strict(),
            )
            .min(1)
            .max(8),
          elapsedMs: z.number().nonnegative(),
          receipts: z.array(airJamRunReceiptSchema).max(128),
        })
        .strict(),
    })
    .strict(),
]);
export type TestProfileRequest = z.infer<typeof testProfileRequestSchema>;
export const testProfileResponseSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ready") }).strict(),
  z
    .object({
      kind: z.literal("initialized"),
      id: z.uuid(),
      profiles: z.array(airJamTestProfileDescriptionSchema),
      preparation: policyPreparationSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("decision"),
      id: z.uuid(),
      decision: airJamPolicyDecisionSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("evaluation"),
      id: z.uuid(),
      verdict: airJamScenarioVerdictSchema,
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
export type TestProfileResponse = z.infer<typeof testProfileResponseSchema>;
export const TEST_PROFILE_IPC_MAX_BYTES = 1_500_000;

export function createPolicyRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}
