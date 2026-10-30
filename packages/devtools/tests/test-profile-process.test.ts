import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, expect, it } from "vitest";
import { prepareProcessScopes } from "../src/managed-process-scope.js";
import { processGuardStartupTimeoutMs } from "../src/process-scope-protocol.js";
import { startTestProfileProcess } from "../src/test-profile-process.js";
import {
  declarationSource,
  testingSource,
} from "./game-declaration-fixture.js";

const cleanups: Array<() => Promise<void>> = [];
beforeAll(async () => {
  await prepareProcessScopes();
}, processGuardStartupTimeoutMs + 1000);
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(
  decide: string,
  options: {
    role?: "discover" | "policy" | "evaluator";
    evaluate?: string;
    create?: string;
    evaluatorCreate?: string;
    signal?: AbortSignal;
    initializationDeadline?: number;
  } = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-policy-ipc-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, "config.mjs"),
    declarationSource({}, 'testing: "./profiles.mjs"'),
  );
  await writeFile(
    path.join(root, "profiles.mjs"),
    testingSource(`profiles: {
    counter: {
      label: "Counter", seats: [{id:"player",label:"Player"}],
      setup: [], actions: ["tap"], scope: "diagnostic", includeImage: false,
      timing: { intervalMs: 20, decisionMs: 50, inputTtlMs: 100 },
      metrics: [], evaluator:{create:${options.evaluatorCreate ?? `()=>({evaluate:${options.evaluate ?? '()=>({status:"pending"})'}})`}},
      policies: { code: { label: "Code", create: ${options.create ?? `({random}) => ({ decide: ${decide} })`} } }
    }
  }`),
  );
  const child = await startTestProfileProcess({
    rootDir: root,
    configPath: path.join(root, "config.mjs"),
    role: options.role ?? "policy",
    startupSignal: options.signal,
    initializationDeadline: options.initializationDeadline,
    profileId: "counter",
    policyId: "code",
    seed: 42,
    logPath: path.join(root, "policy.log"),
  });
  cleanups.push(() => child.stop());
  const observation: HostObservation = {
    version: 1,
    id: randomUUID(),
    identity: {
      documentId: "doc",
      roomId: "ROOM",
      contractId: "contract",
      runtimeId: "runtime",
      surfaceId: null,
      participantId: "receiver",
    },
    sequence: 1,
    scope: "diagnostic",
    controllerId: "player",
    capturedAt: new Date().toISOString(),
    clock: { startedAtMs: 0, finishedAtMs: 0 },
    durationMs: 0,
    snapshot: { count: 3 },
    runtime: null,
    ticks: { before: null, after: null },
    stores: { before: [], after: [] },
    visual: { status: "unavailable", reason: "not-requested" },
  };
  const step = {
    observation,
    seatId: "player",
    intent: null,
    answer: null,
    step: 1,
    elapsedMs: 0,
    receipts: [],
  };
  return { child, step, root };
}

it("uses correlated typed IPC while stdout remains ordinary diagnostic output", async () => {
  const f = await fixture(
    '({observation}) => { console.log("not protocol JSON"); return { control: { kind: "action", actionId: "tap" } }; }',
  );
  expect(f.child.profiles[0].id).toBe("counter");
  expect(await f.child.decide(f.step, 1000)).toEqual({
    control: { kind: "action", actionId: "tap" },
  });
});

it("awaits asynchronous policy preparation and measures it outside authored code", async () => {
  const f = await fixture("unused", {
    create:
      'async () => { await new Promise(resolve => setTimeout(resolve, 80)); return {decide:()=>({control:{kind:"release"}})}; }',
  });
  expect(f.child.preparation).toEqual([
    { seatId: "player", prepareMs: expect.any(Number) },
  ]);
  expect(f.child.preparation[0].prepareMs).toBeGreaterThanOrEqual(70);
  expect(await f.child.decide(f.step, 1000)).toEqual({
    control: { kind: "release" },
  });
});

it("keeps policy preparation out of discovery and evaluator processes", async () => {
  for (const role of ["discover", "evaluator"] as const) {
    const f = await fixture("unused", {
      role,
      create: '()=>{throw new Error("Model must not load in this role");}',
    });
    expect(f.child.preparation).toEqual([]);
  }
});

it("releases startup cancellation once initialized so final judging survives run cancellation", async () => {
  const abort = new AbortController();
  const f = await fixture('()=>({control:{kind:"release"}})', {
    role: "evaluator",
    signal: abort.signal,
  });
  abort.abort();
  expect(
    await f.child.evaluate(
      {
        phase: "final",
        observation: f.step.observation,
        seats: [{ seatId: "player", controllerId: "player" }],
        receipts: [],
        elapsedMs: 0,
      },
      1000,
    ),
  ).toEqual({ status: "pending" });
});

it("propagates a rejected asynchronous preparation and rejects an asynchronous evaluator factory", async () => {
  await expect(
    fixture("unused", {
      create: 'async()=>{throw new Error("model_load_failed");}',
    }),
  ).rejects.toThrow("model_load_failed");
  await expect(
    fixture("unused", {
      role: "evaluator",
      evaluatorCreate: 'async()=>({evaluate:()=>({status:"pending"})})',
    }),
  ).rejects.toThrow("Scenario must provide evaluate");
});

it("cancels slow initialization promptly and bounds it by the remaining run deadline", async () => {
  const slow =
    'async()=>{await new Promise(resolve=>setTimeout(resolve,30000));return{decide:()=>({control:{kind:"release"}})}}';
  const began = performance.now();
  await expect(
    fixture("unused", {
      create: slow,
      signal: AbortSignal.timeout(1000),
      initializationDeadline: performance.now() + 30_000,
    }),
  ).rejects.toThrow("policy_stopped");
  expect(performance.now() - began).toBeLessThan(5000);
  await expect(
    fixture("unused", {
      create: slow,
      initializationDeadline: performance.now() + 800,
    }),
  ).rejects.toThrow("policy_timeout");
});

it("scrubs native inference and provider credentials from the policy environment", async () => {
  const name = "AIRJAM_POLICY_TEST_SECRET";
  const previous = process.env[name];
  process.env[name] = "must-not-reach-policy";
  try {
    const f = await fixture(
      '() => { if(process.env.AIRJAM_POLICY_TEST_SECRET) throw new Error("Secret exposed"); return {control:{kind:"release"}}; }',
    );
    expect(await f.child.decide(f.step, 1000)).toEqual({
      control: { kind: "release" },
    });
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
});

it("discards an expired reply, refuses a second in-flight step and accepts the next fresh step", async () => {
  const f = await fixture(
    'async () => { await new Promise(resolve => setTimeout(resolve, 100)); return {control:{kind:"release"}}; }',
  );
  await expect(f.child.decide(f.step, 10)).rejects.toThrow("policy_timeout");
  await expect(f.child.decide(f.step, 1000)).rejects.toThrow("policy_busy");
  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(await f.child.decide({ ...f.step, step: 2 }, 1000)).toEqual({
    control: { kind: "release" },
  });
});

it("terminates a non-cooperating policy without waiting for its unresolved decision", async () => {
  const f = await fixture("() => new Promise(() => {})");
  const pending = f.child.decide(f.step, 1000).catch((error) => error);
  await f.child.stop();
  expect(await pending).toBeInstanceOf(Error);
  await f.child.stop();
});

it("bounds policy diagnostics on disk and terminates a child that floods stdout", async () => {
  const f = await fixture(
    '() => { console.log("x".repeat(1_100_000)); return new Promise(() => {}); }',
  );
  await expect(f.child.decide(f.step, 2000)).rejects.toThrow(
    "policy_log_limit",
  );
  await f.child.stop();
  expect(
    (await stat(path.join(f.root, "policy.log"))).size,
  ).toBeLessThanOrEqual(1_000_000);
});

it("rejects actor-authored verdicts rather than letting a policy declare its own success", async () => {
  const f = await fixture(
    '()=>({control:{kind:"release"},outcome:{status:"passed",message:"I won"}})',
  );
  await expect(f.child.decide(f.step, 1000)).rejects.toThrow(/outcome/);
});

it("keeps judging in a separate role and rejects asynchronous scenario verdicts", async () => {
  const f = await fixture('()=>{throw new Error("Actor must never run");}', {
    role: "evaluator",
    evaluate: 'async()=>({status:"passed"})',
  });
  await expect(f.child.decide(f.step, 1000)).rejects.toThrow(
    "Only a policy process",
  );
  await expect(
    f.child.evaluate(
      {
        phase: "final",
        observation: f.step.observation,
        seats: [{ seatId: "player", controllerId: "player" }],
        receipts: [],
        elapsedMs: 0,
      },
      1000,
    ),
  ).rejects.toThrow();
});

it("detects missing and repeated global effect receipts before calling authored evaluation", async () => {
  const f = await fixture('()=>({control:{kind:"release"}})', {
    role: "evaluator",
    evaluate:
      'sample=>({status:sample.receipts.length ? "passed" : "pending"})',
  });
  const sample = {
    phase: "play" as const,
    observation: f.step.observation,
    seats: [{ seatId: "player", controllerId: "player" }],
    receipts: [],
    elapsedMs: 0,
  };
  const receipt = {
    index: 1,
    seatId: "player",
    phase: "play" as const,
    sequence: 1,
    attempts: 1 as const,
    operation: { kind: "release" as const },
    acknowledgement: {
      status: "applied" as const,
      leaseId: randomUUID(),
      sequence: 1,
      replayed: false,
      operation: { kind: "release" as const },
    },
  };
  expect(
    await f.child.evaluate({ ...sample, receipts: [receipt] }, 1000),
  ).toEqual({ status: "passed" });
  await expect(
    f.child.evaluate({ ...sample, receipts: [receipt] }, 1000),
  ).rejects.toThrow("receipt_protocol");
  await expect(
    f.child.evaluate(
      { ...sample, receipts: [{ ...receipt, index: 3, sequence: 3 }] },
      1000,
    ),
  ).rejects.toThrow("receipt_protocol");
});
