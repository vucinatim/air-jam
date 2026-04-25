import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
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

  assert.match(output, /Usage: airjam dev/);
  assert.match(output, /--secure/);
  assert.match(output, /--server-only/);
});

test("create-airjam exposes secure:init help", () => {
  const output = runCliHelp("secure:init");

  assert.match(output, /Usage: airjam secure:init/);
  assert.match(output, /--mode <mode>/);
  assert.match(output, /--hostname <hostname>/);
});

test("create-airjam exposes topology help", () => {
  const output = runCliHelp("topology");

  assert.match(output, /Usage: airjam topology/);
  assert.match(output, /--mode <mode>/);
  assert.match(output, /standalone-dev/);
});

test("create-airjam keeps ai-pack help", () => {
  const output = runCliHelp("ai-pack", "status");

  assert.match(output, /Usage: airjam ai-pack status/);
  assert.match(output, /--manifest-url <url>/);
});

test("create-airjam keeps release bundle help", () => {
  const output = runCliHelp("release", "bundle");

  assert.match(output, /Usage: airjam release bundle/);
  assert.match(output, /--dist-dir <path>/);
});

test("create-airjam exposes release doctor help", () => {
  const output = runCliHelp("release", "doctor");

  assert.match(output, /Usage: airjam release doctor/);
  assert.match(output, /--dist-dir <path>/);
});

test("create-airjam exposes release validate help", () => {
  const output = runCliHelp("release", "validate");

  assert.match(output, /Usage: airjam release validate/);
  assert.match(output, /--bundle <path>/);
});

test("create-airjam exposes release list help", () => {
  const output = runCliHelp("release", "list");

  assert.match(output, /Usage: airjam release list/);
  assert.match(output, /--game <slug-or-id>/);
});

test("create-airjam exposes release inspect help", () => {
  const output = runCliHelp("release", "inspect");

  assert.match(output, /Usage: airjam release inspect/);
  assert.match(output, /--release <id>/);
});

test("create-airjam exposes release submit help", () => {
  const output = runCliHelp("release", "submit");

  assert.match(output, /Usage: airjam release submit/);
  assert.match(output, /--game <slug-or-id>/);
  assert.match(output, /--publish/);
});

test("create-airjam exposes release publish help", () => {
  const output = runCliHelp("release", "publish");

  assert.match(output, /Usage: airjam release publish/);
  assert.match(output, /--release <id>/);
});

test("create-airjam exposes auth login help", () => {
  const output = runCliHelp("auth", "login");

  assert.match(output, /Usage: airjam auth login/);
  assert.match(output, /--platform-url <url>/);
});

test("create-airjam exposes auth whoami help", () => {
  const output = runCliHelp("auth", "whoami");

  assert.match(output, /Usage: airjam auth whoami/);
  assert.match(output, /--platform-url <url>/);
});

test("create-airjam exposes auth logout help", () => {
  const output = runCliHelp("auth", "logout");

  assert.match(output, /Usage: airjam auth logout/);
  assert.match(output, /--platform-url <url>/);
});

test("create-airjam exposes mcp help", () => {
  const output = runCliHelp("mcp", "doctor");

  assert.match(output, /Usage: airjam mcp doctor/);
  assert.match(output, /--dir <path>/);
});
