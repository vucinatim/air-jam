import assert from "node:assert/strict";
import test from "node:test";
import { buildPerfSanityArgs } from "../lib/perf-plan.mjs";

test("a profile sizes the load smoke and explicit options override it", () => {
  assert.deepEqual(buildPerfSanityArgs({ profile: "ci", rooms: 4 }), [
    "--filter",
    "@air-jam/devtools",
    "perf:sanity",
    "--",
    "--rooms=4",
    "--phones=4",
    "--durationMs=15000",
    "--workers=2",
  ]);
  assert.throws(
    () => buildPerfSanityArgs({ profile: "unknown" }),
    /Unknown performance profile/,
  );
});
