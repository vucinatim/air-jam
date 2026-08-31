import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  const plan = buildChangedCheckPlan(["packages/sdk/src/index.ts"], {
    projects: ["apps/platform", "packages/sdk"],
    fileExists: () => true,
  });

  assert.deepEqual(plan.changed.lintFiles, ["packages/sdk/src/index.ts"]);
  assert.deepEqual(plan.changed.typecheckProjects, ["packages/sdk"]);
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

test("too many affected projects require the deliberately slower batch gate", () => {
  const projects = ["apps/a", "apps/b", "apps/c", "apps/d", "apps/e"];
  const plan = buildChangedCheckPlan(
    projects.map((project) => `${project}/index.ts`),
    { projects, fileExists: () => true },
  );

  assert.equal(plan.batchRequired, true);
  assert.match(plan.batchReasons[0], /5 TypeScript projects/);
});
