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
  assert.match(operationsHelp, /emergency-pause/u);
  assert.match(laneHelp, /set/u);
});

test("emergency pause is discoverable, preview-first, audited, and explicitly scoped", () => {
  const help = readHelp("platform", "operations", "emergency-pause");
  for (const flag of [
    "--apply",
    "--actor",
    "--reason",
    "--idempotency-key",
    "--json",
    "--railway-environment",
    "--retry-after-seconds",
  ]) {
    assert.ok(help.includes(flag), `missing ${flag}`);
  }
  assert.match(help, /read-only\s+preview/u);
  assert.match(help, /preserve active work, cleanup, and telemetry/u);
  assert.match(help, /retries\s+do not re-pause recovered lanes/u);
  assert.doesNotMatch(help, /--lane\b/u);
  assert.doesNotMatch(help, /--mode\b/u);
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
