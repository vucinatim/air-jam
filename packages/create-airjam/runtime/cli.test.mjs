import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, "..");

const runCliHelp = (...args) =>
  execFileSync(
    process.execPath,
    ["--import", "tsx", "src/index.ts", ...args, "--help"],
    {
      cwd: packageRoot,
      encoding: "utf8",
    },
  );

test("create-airjam exposes dev help", () => {
  const output = runCliHelp("dev");

  assert.match(output, /Usage: create-airjam dev/);
  assert.match(output, /--secure/);
  assert.match(output, /--server-only/);
});

test("create-airjam exposes secure:init help", () => {
  const output = runCliHelp("secure:init");

  assert.match(output, /Usage: create-airjam secure:init/);
  assert.match(output, /--mode <mode>/);
  assert.match(output, /--hostname <hostname>/);
});

test("create-airjam keeps ai-pack help", () => {
  const output = runCliHelp("ai-pack", "status");

  assert.match(output, /Usage: create-airjam ai-pack status/);
  assert.match(output, /--manifest-url <url>/);
});

test("create-airjam keeps release bundle help", () => {
  const output = runCliHelp("release", "bundle");

  assert.match(output, /Usage: create-airjam release bundle/);
  assert.match(output, /--dist-dir <path>/);
});
