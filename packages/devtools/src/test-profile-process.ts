import { randomUUID } from "node:crypto";
import { closeSync, openSync, writeSync } from "node:fs";
import type { z } from "zod";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
  resolveProjectDevtoolsHelperScript,
} from "./helper-scripts.js";
import {
  closeAfterProcessFailure,
  closeScopedProcess,
  spawnScopedProcess,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";
import type { policyArtifactReceiptSchema } from "./policy-artifact-contract.js";
import { processScopeAdmissionSchema } from "./process-scope-protocol.js";
import {
  TEST_PROFILE_IPC_MAX_BYTES,
  testProfileRequestSchema,
  testProfileResponseSchema,
  type TestProfileRequest,
  type TestProfileResponse,
} from "./test-profile-protocol.js";
import type {
  AirJamPolicyDecision,
  AirJamPolicyStep,
  AirJamScenarioSample,
  AirJamScenarioVerdict,
  AirJamTestProfileDescription,
  policyPreparationSchema,
} from "./testing.js";

const environmentKeys = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "NODE_EXTRA_CA_CERTS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
];

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
  const helper = toolingRootDir
    ? resolveProjectDevtoolsHelperScript(toolingRootDir, "run-test-profile.ts")
    : resolveDevtoolsHelperScript("run-test-profile.ts");
  const logDescriptor = openSync(logPath, "w", 0o600);
  const child = await spawnScopedProcess(resolveDevtoolsHelperArgs(helper), {
    cwd: rootDir,
    onScope,
    env: Object.fromEntries(
      environmentKeys.flatMap((key) =>
        process.env[key] === undefined ? [] : [[key, process.env[key]]],
      ),
    ),
  }).catch((error) => {
    closeSync(logDescriptor);
    throw error;
  });
  let failure: Error | undefined;
  let ready = false;
  let pending:
    | {
        id: string;
        resolve: (value: TestProfileResponse) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
        expired: boolean;
      }
    | undefined;
  let stopping: Promise<void> | undefined;
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const boot = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const fail = (error: Error) => {
    failure ??= error;
    rejectReady(error);
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
  };
  child.on("error", fail);
  child.once("exit", () => {
    fail(new Error("policy_exited: Policy process is unavailable."));
  });
  let logBytes = 0;
  const log = (chunk: Buffer) => {
    const remaining = 1_000_000 - logBytes;
    if (remaining > 0) {
      const bounded = chunk.subarray(0, remaining);
      try {
        let offset = 0;
        while (offset < bounded.length)
          offset += writeSync(logDescriptor, bounded.subarray(offset));
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        child.kill("SIGKILL");
      }
    }
    logBytes += chunk.length;
    if (logBytes > 1_000_000) {
      fail(
        new Error(
          "policy_log_limit: Policy exceeded its 1 MB diagnostic log budget.",
        ),
      );
      child.kill("SIGKILL");
    }
  };
  child.stdout?.on("data", log);
  child.stderr?.on("data", log);
  child.on("message", (message: unknown) => {
    if (message === 0) return;
    if (processScopeAdmissionSchema.safeParse(message).success) return;
    try {
      if (
        Buffer.byteLength(JSON.stringify(message)) > TEST_PROFILE_IPC_MAX_BYTES
      )
        throw new Error("policy_protocol: Oversized response.");
      const result = testProfileResponseSchema.parse(message);
      if (result.kind === "ready") {
        if (ready) throw new Error("policy_protocol: Duplicate startup.");
        ready = true;
        resolveReady();
        return;
      }
      if (!pending || result.id !== pending.id)
        throw new Error("policy_protocol: Unexpected decision ID.");
      const request = pending;
      pending = undefined;
      clearTimeout(request.timer);
      if (!request.expired) request.resolve(result);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      child.kill("SIGKILL");
    }
  });
  const request = (input: TestProfileRequest, timeoutMs: number) => {
    if (failure) return Promise.reject(failure);
    if (pending)
      return Promise.reject(
        new Error("policy_busy: Previous decision has not returned."),
      );
    const parsed = testProfileRequestSchema.parse(input);
    if (Buffer.byteLength(JSON.stringify(parsed)) > TEST_PROFILE_IPC_MAX_BYTES)
      return Promise.reject(
        new Error("Policy request exceeds its byte budget."),
      );
    return new Promise<TestProfileResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending?.id !== parsed.id) return;
        pending.expired = true;
        reject(new Error("policy_timeout: Decision exceeded its deadline."));
      }, timeoutMs);
      pending = { id: parsed.id, resolve, reject, timer, expired: false };
      child.send(parsed, (error) => {
        if (error) fail(error);
      });
    });
  };
  const stop = () =>
    (stopping ??= (async () => {
      startupSignal?.removeEventListener("abort", aborted);
      fail(new Error("policy_stopped"));
      try {
        await closeScopedProcess(child);
      } finally {
        child.stdout?.destroy();
        child.stderr?.destroy();
        closeSync(logDescriptor);
      }
    })());
  const aborted = () => {
    void stop().catch(() => undefined);
  };
  startupSignal?.addEventListener("abort", aborted, { once: true });
  const bootTimeout = setTimeout(
    () => fail(new Error("policy_startup_timeout")),
    10_000,
  );
  try {
    if (startupSignal?.aborted) aborted();
    await boot;
    clearTimeout(bootTimeout);
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
      busy: () => pending !== undefined,
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
      stop,
    };
  } catch (error) {
    return closeAfterProcessFailure(stop, error);
  } finally {
    clearTimeout(bootTimeout);
    startupSignal?.removeEventListener("abort", aborted);
  }
}
