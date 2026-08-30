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

test("shadow quota inspection and decisions are discoverable through one repo CLI", () => {
  const operationsHelp = readHelp("platform", "operations");
  const quotaHelp = readHelp("platform", "operations", "quota");
  const statusHelp = readHelp("platform", "operations", "quota", "status");
  const checkHelp = readHelp("platform", "operations", "quota", "check");

  assert.match(operationsHelp, /quota/u);
  assert.match(quotaHelp, /status/u);
  assert.match(quotaHelp, /check/u);
  assert.match(statusHelp, /--creator/u);
  assert.match(statusHelp, /--game/u);
  assert.match(statusHelp, /--json/u);
  assert.match(checkHelp, /--key/u);
  assert.match(checkHelp, /--lane/u);
  assert.match(checkHelp, /--amount/u);
  assert.match(checkHelp, /--creator/u);
  assert.match(checkHelp, /--game/u);
  assert.match(checkHelp, /--json/u);
  assert.doesNotMatch(checkHelp, /--limit/u);
  assert.doesNotMatch(checkHelp, /--budget-state/u);
  assert.doesNotMatch(checkHelp, /--outcome/u);
});
