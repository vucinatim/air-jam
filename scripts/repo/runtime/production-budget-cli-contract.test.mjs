import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectRailwayProjectBudgetEvidence } from "../commands/platform.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const readHelp = (...args) =>
  execFileSync(process.execPath, [cliPath, ...args, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

test("production budget lifecycle is discoverable through one repo CLI", () => {
  const operationsHelp = readHelp("platform", "operations");
  const budgetHelp = readHelp("platform", "operations", "budget");
  const statusHelp = readHelp("platform", "operations", "budget", "status");
  const syncHelp = readHelp("platform", "operations", "budget", "sync");

  assert.match(operationsHelp, /budget/u);
  assert.match(budgetHelp, /status/u);
  assert.match(budgetHelp, /sync/u);
  assert.match(statusHelp, /--json/u);
  assert.match(syncHelp, /--actor/u);
  assert.match(syncHelp, /--reason/u);
  assert.match(syncHelp, /--idempotency-key/u);
  assert.match(syncHelp, /--apply/u);
  assert.match(syncHelp, /read-only preview/u);
  assert.match(syncHelp, /--railway-project/u);
  assert.doesNotMatch(syncHelp, /--state/u);
  assert.doesNotMatch(syncHelp, /--threshold/u);
  assert.doesNotMatch(syncHelp, /--ceiling/u);
});

test("budget collection fetches authoritative Railway evidence itself", async () => {
  const expected = { contractVersion: 1, provider: "railway" };
  const calls = [];
  const result = await collectRailwayProjectBudgetEvidence(
    { projectId: "  project-1  " },
    {
      createClient: () => ({
        getProjectUsageEvidence: async (input) => {
          calls.push(input);
          return expected;
        },
      }),
    },
  );

  assert.deepEqual(result, expected);
  assert.deepEqual(calls, [{ projectId: "project-1" }]);
  await assert.rejects(
    collectRailwayProjectBudgetEvidence(
      { projectId: null },
      { createClient: () => assert.fail("client should not be created") },
    ),
    /requires --railway-project/u,
  );
});
