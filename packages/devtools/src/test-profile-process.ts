import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { startHelperChannel } from "./helper-channel.js";
import {
  closeAfterProcessFailure,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";
import type { policyArtifactReceiptSchema } from "./policy-artifact-contract.js";
import {
  TEST_PROFILE_IPC_MAX_BYTES,
  testProfileRequestSchema,
  testProfileResponseSchema,
  type TestProfileRequest,
} from "./test-profile-protocol.js";
import type {
  AirJamPolicyDecision,
  AirJamPolicyStep,
  AirJamScenarioSample,
  AirJamScenarioVerdict,
  AirJamTestProfileDescription,
  policyPreparationSchema,
} from "./testing.js";

export async function startTestProfileProcess({
  rootDir,
  configPath,
  profileId,
  policyId,
  seed,
  logPath,
  role,
  toolingRootDir,
  onScope,
  startupSignal,
  initializationDeadline,
  artifacts,
}: {
  rootDir: string;
  toolingRootDir?: string;
  onScope?: ProcessScopeObserver;
  startupSignal?: AbortSignal;
  initializationDeadline?: number;
  artifacts?: {
    directory: string;
    receipt: z.infer<typeof policyArtifactReceiptSchema>;
  };
  configPath: string;
  profileId?: string;
  policyId?: string;
  seed: number;
  logPath: string;
  role: "discover" | "policy" | "evaluator";
}): Promise<{
  profiles: AirJamTestProfileDescription[];
  preparation: z.infer<typeof policyPreparationSchema>;
  decide: (
    step: AirJamPolicyStep,
    timeoutMs: number,
  ) => Promise<AirJamPolicyDecision>;
  evaluate: (
    sample: AirJamScenarioSample,
    timeoutMs: number,
  ) => Promise<AirJamScenarioVerdict>;
  busy: () => boolean;
  stop: () => Promise<void>;
}> {
  startupSignal?.throwIfAborted();
  if (role !== "policy" && initializationDeadline !== undefined)
    throw new Error("Only a policy can use the run's initialization deadline.");
  if (role !== "policy" && artifacts !== undefined)
    throw new Error("Only a policy can receive model artifacts.");
  const channel = await startHelperChannel({
    name: "policy",
    helper: "run-test-profile.ts",
    rootDir,
    toolingRootDir,
    onScope,
    startupSignal,
    logPath,
    maxBytes: TEST_PROFILE_IPC_MAX_BYTES,
    requestSchema: testProfileRequestSchema,
    responseSchema: testProfileResponseSchema,
  });
  const request = (input: TestProfileRequest, timeoutMs: number) =>
    channel.request(input, timeoutMs);
  try {
    const initialized = await request(
      {
        kind: "initialize",
        id: randomUUID(),
        rootDir,
        configPath,
        profileId,
        policyId,
        seed,
        role,
        ...(artifacts ? { artifacts } : {}),
      },
      initializationDeadline === undefined
        ? 10_000
        : Math.max(1, initializationDeadline - performance.now()),
    );
    if (initialized.kind !== "initialized")
      throw new Error(
        initialized.kind === "error"
          ? initialized.message
          : "Invalid policy initialization response.",
      );
    return {
      profiles: initialized.profiles,
      preparation: initialized.preparation,
      busy: channel.busy,
      async decide(step: AirJamPolicyStep, timeoutMs: number) {
        if (role !== "policy")
          throw new Error("Only a policy process can decide.");
        const result = await request(
          { kind: "decide", id: randomUUID(), step },
          timeoutMs,
        );
        if (result.kind !== "decision")
          throw new Error(
            result.kind === "error"
              ? result.message
              : "Invalid policy decision response.",
          );
        return result.decision;
      },
      async evaluate(sample: AirJamScenarioSample, timeoutMs: number) {
        if (role !== "evaluator")
          throw new Error("Only an evaluator process can judge.");
        const result = await request(
          { kind: "evaluate", id: randomUUID(), sample },
          timeoutMs,
        );
        if (result.kind !== "evaluation")
          throw new Error(
            result.kind === "error"
              ? result.message
              : "Invalid scenario evaluation response.",
          );
        return result.verdict;
      },
      stop: channel.stop,
    };
  } catch (error) {
    return closeAfterProcessFailure(channel.stop, error);
  } finally {
    channel.started();
  }
}
