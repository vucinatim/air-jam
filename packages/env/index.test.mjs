import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  EnvValidationError,
  formatEnvValidationError,
  isEnvValidationError,
  validateEnv,
} from "./index.mjs";

test("validateEnv throws EnvValidationError for missing required env", () => {
  const schema = z.object({
    AIR_JAM_APP_ID: z.string().min(1, "AIR_JAM_APP_ID is required"),
  });

  assert.throws(
    () =>
      validateEnv({
        boundary: "test.boundary",
        schema,
        env: {},
      }),
    (error) => {
      assert.ok(error instanceof EnvValidationError);
      assert.equal(error.boundary, "test.boundary");
      assert.equal(error.issues.length, 1);
      assert.equal(error.issues[0].envKey, "AIR_JAM_APP_ID");
      assert.equal(error.issues[0].received, undefined);
      return true;
    },
  );
});

test("validateEnv keeps issue ordering deterministic by env key", () => {
  const schema = z.object({
    Z_VAR: z.string().min(1, "Z_VAR is required"),
    A_VAR: z.string().min(1, "A_VAR is required"),
  });

  try {
    validateEnv({
      boundary: "test.boundary",
      schema,
      env: { A_VAR: "", Z_VAR: "" },
    });
    assert.fail("Expected validation to throw");
  } catch (error) {
    assert.ok(isEnvValidationError(error));
    assert.deepEqual(
      error.issues.map((issue) => issue.envKey),
      ["A_VAR", "Z_VAR"],
    );
  }
});

test("formatEnvValidationError supports plain and colored output", () => {
  const schema = z.object({
    AIR_JAM_AUTH_MODE: z.enum(["disabled", "required"]),
  });

  let caught;
  try {
    validateEnv({
      boundary: "air-jam.server",
      schema,
      env: {
        AIR_JAM_AUTH_MODE: "invalid",
      },
      docsHint: "Check .env.local and docs/env-contracts.md.",
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught instanceof EnvValidationError);

  const plain = formatEnvValidationError(caught, { color: false });
  assert.ok(plain.includes("air-jam.server: invalid environment configuration"));
  assert.ok(plain.includes("AIR_JAM_AUTH_MODE"));
  assert.ok(plain.includes("received: \"invalid\""));
  assert.ok(!plain.includes("\u001b["));

  const colored = formatEnvValidationError(caught, { color: true });
  assert.ok(colored.includes("\u001b["));
});
