import assert from "node:assert/strict";
import test from "node:test";
import { buildPerfSanityArgs } from "../lib/perf-plan.mjs";

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
