import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { repoRoot } from "../lib/paths.mjs";
import { buildLaunchLoadArgs, buildPerfSanityArgs } from "../lib/perf-plan.mjs";

test("launch load forwards the default smoke profile without starting a rehearsal", () => {
  assert.deepEqual(buildLaunchLoadArgs(), [
    "--silent",
    "--filter",
    "@air-jam/server",
    "exec",
    "tsx",
    "scripts/launch-load/main.ts",
    "--profile=smoke",
  ]);
});

test("launch load forwards explicit profile, output path and JSON as separate arguments", () => {
  assert.deepEqual(
    buildLaunchLoadArgs({
      profile: "release",
      output: "/tmp/load evidence/run",
      json: true,
    }),
    [
      "--silent",
      "--filter",
      "@air-jam/server",
      "exec",
      "tsx",
      "scripts/launch-load/main.ts",
      "--profile=release",
      "--output=/tmp/load evidence/run",
      "--json",
    ],
  );
});

test("launch load leaves profile validation with the scenario owner", () => {
  assert.equal(
    buildLaunchLoadArgs({ profile: "unknown" }).at(-1),
    "--profile=unknown",
  );
  assert.ok(!buildLaunchLoadArgs({ json: false }).includes("--json"));
});

test("launch load help declares exact local database effects without executing them", () => {
  const help = execFileSync(
    process.execPath,
    ["scripts/repo/cli.mjs", "perf", "launch-load", "--help"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.match(help, /--profile <profile>/);
  assert.match(help, /default: "smoke"/);
  assert.match(help, /--output <path>/);
  assert.match(help, /--json/);
  assert.match(help, /only the final/);
  assert.match(help, /Creates and disposes a new loopback database/);
  assert.match(help, /AIR_JAM_TEST_DATABASE_URL/);
  assert.match(help, /Never uses a production target/);
});

test("existing performance sanity arguments remain unchanged", () => {
  assert.deepEqual(buildPerfSanityArgs(), [
    "--filter",
    "server",
    "perf:sanity",
  ]);
  assert.deepEqual(buildPerfSanityArgs({ profile: "ci", controllers: 4 }), [
    "--filter",
    "server",
    "perf:sanity",
    "--",
    "--controllers=4",
    "--durationMs=15000",
    "--warmupMs=1000",
    "--reconnectCycles=5",
    "--strict",
  ]);
  assert.throws(
    () => buildPerfSanityArgs({ profile: "unknown" }),
    /Unknown performance profile/,
  );
});
