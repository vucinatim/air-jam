import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { buildChangedCheckPlan, fastCheckTargets } from "../lib/check-plan.mjs";

test("layered checks are discoverable through the canonical repo CLI", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/repo/cli.mjs", "check", "--help"],
    { encoding: "utf8" },
  );

  assert.match(output, /instant/);
  assert.match(output, /changed/);
  assert.match(output, /batch/);
});

test("the fast check contract keeps explicit warm latency budgets", () => {
  assert.equal(fastCheckTargets.instantWarmMs, 1_000);
  assert.equal(fastCheckTargets.changedWarmMs, 5_000);
});

test("a focused source edit selects lint and only its TypeScript project", () => {
  const plan = buildChangedCheckPlan(["packages/database-contract/src/index.ts"], {
    projects: ["apps/platform", "packages/database-contract"],
    fileExists: () => true,
  });

  assert.deepEqual(plan.changed.lintFiles, ["packages/database-contract/src/index.ts"]);
  assert.deepEqual(plan.changed.typecheckProjects, ["packages/database-contract"]);
  assert.equal(plan.batchRequired, false);
});

test("central configuration changes escalate without expanding the fast gate", () => {
  const plan = buildChangedCheckPlan(["tsconfig.base.json"], {
    projects: [],
    fileExists: () => true,
  });

  assert.equal(plan.batchRequired, true);
  assert.deepEqual(plan.batchReasons, [
    "central configuration changed: tsconfig.base.json",
  ]);
});

test("a project tsconfig change selects that project typecheck", () => {
  const plan = buildChangedCheckPlan(["packages/sdk/tsconfig.json"], {
    projects: ["packages/sdk"],
    fileExists: () => true,
  });

  assert.deepEqual(plan.changed.typecheckProjects, ["packages/sdk"]);
});

test("a test edit selects the nearest test-owned TypeScript project", () => {
  const plan = buildChangedCheckPlan(["packages/sdk/tests/agent-contract.test.ts"], {
    projects: ["packages/sdk/tests", "packages/sdk"],
    fileExists: () => true,
  });

  assert.deepEqual(plan.changed.typecheckProjects, ["packages/sdk/tests"]);
  assert.equal(plan.batchRequired, false);
});

test("deleted typed files still select their owning project", () => {
  const plan = buildChangedCheckPlan(["packages/sdk/src/deleted.ts"], {
    projects: ["packages/sdk"],
    fileExists: () => false,
  });

  assert.deepEqual(plan.changed.typecheckProjects, ["packages/sdk"]);
});

test("public SDK source changes escalate to consumer-compatible batch proof", () => {
  const plan = buildChangedCheckPlan(["packages/sdk/src/index.ts"], {
    projects: ["packages/sdk"],
    fileExists: () => true,
  });

  assert.equal(plan.batchRequired, true);
  assert.match(plan.batchReasons[0], /consumer compatibility/);
});

test("explicit unknown files fail without a raw stack trace", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/repo/cli.mjs", "check", "changed", "--files", "not-a-real-file.ts"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not exist or belong to Git/);
  assert.doesNotMatch(result.stderr, /at runChangedCommand|node:internal/);
});

test("too many affected projects require the deliberately slower batch gate", () => {
  const projects = ["apps/a", "apps/b", "apps/c", "apps/d", "apps/e"];
  const plan = buildChangedCheckPlan(
    projects.map((project) => `${project}/index.ts`),
    { projects, fileExists: () => true },
  );

  assert.equal(plan.batchRequired, true);
  assert.match(plan.batchReasons[0], /5 TypeScript projects/);
});
