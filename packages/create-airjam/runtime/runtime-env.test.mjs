import assert from "node:assert/strict";
import test from "node:test";
import { EnvValidationError } from "@air-jam/env";
import { loadCreateAirJamRuntimeEnv } from "./runtime-env.mjs";

test("loadCreateAirJamRuntimeEnv parses defaults", () => {
  const runtimeEnv = loadCreateAirJamRuntimeEnv({
    env: {},
    boundary: "create-airjam.runtime-test",
  });

  assert.equal(runtimeEnv.VITE_PORT, 5173);
  assert.equal(runtimeEnv.AIR_JAM_SECURE_MODE, undefined);
});

test("loadCreateAirJamRuntimeEnv rejects invalid secure mode", () => {
  assert.throws(
    () =>
      loadCreateAirJamRuntimeEnv({
        env: { AIR_JAM_SECURE_MODE: "unsupported" },
        boundary: "create-airjam.runtime-test",
      }),
    EnvValidationError,
  );
});

test("loadCreateAirJamRuntimeEnv rejects invalid VITE_PORT", () => {
  assert.throws(
    () =>
      loadCreateAirJamRuntimeEnv({
        env: { VITE_PORT: "abc" },
        boundary: "create-airjam.runtime-test",
      }),
    EnvValidationError,
  );
});
