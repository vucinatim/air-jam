import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { repoRoot } from "../lib/paths.mjs";
import { buildTestPlan, testProjects } from "../lib/test-plan.mjs";

const filesByProject = (tier) =>
  new Map(buildTestPlan({ tier }).map(({ id, files }) => [id, files]));

test("fast and slow tiers cover every test exactly once", () => {
  const fast = filesByProject("fast");
  const slow = filesByProject("slow");
  for (const project of testProjects()) {
    const fastFiles = fast.get(project.id) ?? [];
    const slowFiles = slow.get(project.id) ?? [];
    assert.equal(
      fastFiles.filter((file) => slowFiles.includes(file)).length,
      0,
    );
    const expected = readdirSync(
      path.join(repoRoot, project.directory, project.tests),
      { recursive: project.id !== "env" },
    )
      .filter((file) => /\.test\.(?:mjs|ts|tsx)$/.test(file))
      .map((file) => `${project.tests}/${file.split(path.sep).join("/")}`)
      .sort();
    assert.deepEqual([...fastFiles, ...slowFiles].sort(), expected, project.id);
  }
});

test("process and fixture suites stay slow while unit behavior stays fast", () => {
  const fast = filesByProject("fast");
  const slow = filesByProject("slow");
  assert.ok(fast.get("sdk").includes("tests/core-simulation.test.ts"));
  assert.ok(fast.get("devtools").includes("tests/game-run-watch.test.ts"));
  assert.ok(slow.get("devtools").includes("tests/game-run-owner.test.ts"));
  assert.ok(
    slow.get("repo").includes("runtime/canonical-scanner.slow.test.mjs"),
  );
  assert.ok(
    slow.get("server").includes("tests/game-lifecycle.integration.test.ts"),
  );
});

test("project selection narrows either tier and rejects unknown input", () => {
  assert.deepEqual(
    buildTestPlan({ tier: "slow", projects: ["devtools"] }).map(({ id }) => id),
    ["devtools"],
  );
  assert.throws(() => buildTestPlan({ tier: "long" }), /Unknown test tier/);
  assert.throws(
    () => buildTestPlan({ projects: ["typo"] }),
    /Unknown test project/,
  );
});
