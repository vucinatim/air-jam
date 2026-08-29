import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

test("production controls are discoverable through the canonical repo CLI", () => {
  const platformHelp = readHelp("platform");
  const operationsHelp = readHelp("platform", "operations");
  const laneHelp = readHelp("platform", "operations", "lane");

  assert.match(platformHelp, /operations/u);
  assert.match(operationsHelp, /status/u);
  assert.match(operationsHelp, /lane/u);
  assert.match(laneHelp, /set/u);
});

test("control mutations are preview-first, optimistic, audited, and remotely targetable", () => {
  const statusHelp = readHelp("platform", "operations", "status");
  const setHelp = readHelp("platform", "operations", "lane", "set");

  assert.match(statusHelp, /--json/u);
  assert.match(statusHelp, /--railway-environment/u);
  assert.match(statusHelp, /--railway-project/u);
  assert.match(setHelp, /--apply/u);
  assert.match(setHelp, /read-only\s+preview/u);
  assert.match(setHelp, /--expected-revision/u);
  assert.match(setHelp, /--idempotency-key/u);
  assert.match(setHelp, /--actor/u);
  assert.match(setHelp, /--reason/u);
  assert.match(setHelp, /--retry-after-seconds/u);
  assert.match(setHelp, /--json/u);
});
