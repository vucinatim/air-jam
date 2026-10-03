import { formatEnvValidationError } from "@air-jam/env";
import assert from "node:assert/strict";
import test from "node:test";
import { loadBrowserWorkerEnv } from "./env";

const token = "unit-test-browser-token-0123456789abcdef";
const valid = { AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: token };

test("loadBrowserWorkerEnv requires a token and defaults to sandboxed Chromium", () => {
  const env = loadBrowserWorkerEnv({
    ...valid,
  });

  assert.equal(env.port, 8080);
  assert.equal(env.accessToken, token);
  assert.equal(env.host, "0.0.0.0");
  assert.equal(env.headless, true);
  assert.equal(env.chromiumSandbox, true);
});

test("requires a valid token in local and production environments without exposing its value", () => {
  for (const NODE_ENV of ["development", "test", "production"]) {
    for (const value of [
      undefined,
      "",
      " ",
      "a".repeat(31),
      "a".repeat(513),
      ` ${token}`,
      `${token} `,
      `${token}\n`,
      `${token}\t`,
      `${token}\u007f`,
      `${token}é`,
    ]) {
      assert.throws(
        () =>
          loadBrowserWorkerEnv({
            NODE_ENV,
            AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: value,
          }),
        (error: unknown) => {
          assert.match(String(error), /invalid environment configuration/);
          if (value && value.length > 1)
            assert.equal(JSON.stringify(error).includes(value), false);
          assert.equal(JSON.stringify(error).includes(token), false);
          assert.equal(
            formatEnvValidationError(error, { includeReceived: true }).includes(
              token,
            ),
            false,
          );
          return true;
        },
      );
    }
  }
  for (const value of ["a".repeat(32), "a".repeat(512)])
    assert.equal(
      loadBrowserWorkerEnv({ AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: value })
        .accessToken,
      value,
    );
});

test("accepts explicit sandboxing but rejects disabling or malformed sandbox configuration", () => {
  assert.equal(
    loadBrowserWorkerEnv({
      ...valid,
      AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX: "true",
    }).chromiumSandbox,
    true,
  );
  for (const value of ["false", "0", "FALSE", "yes"])
    assert.throws(() =>
      loadBrowserWorkerEnv({
        ...valid,
        AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX: value,
      }),
    );
});

test("parses complete ports in range and preserves managed PORT precedence", () => {
  for (const key of ["PORT", "AIRJAM_BROWSER_WORKER_PORT"]) {
    for (const value of ["1", "8080", "65535"])
      assert.equal(
        loadBrowserWorkerEnv({ ...valid, [key]: value }).port,
        Number(value),
      );
    for (const value of [
      "0",
      "-1",
      "65536",
      "8080junk",
      "80.5",
      "1e3",
      "+80",
      "NaN",
      "Infinity",
      "0x50",
    ])
      assert.throws(() => loadBrowserWorkerEnv({ ...valid, [key]: value }));
  }
  assert.equal(
    loadBrowserWorkerEnv({
      ...valid,
      PORT: "9000",
      AIRJAM_BROWSER_WORKER_PORT: "8080",
    }).port,
    9000,
  );
  assert.throws(() =>
    loadBrowserWorkerEnv({
      ...valid,
      PORT: "invalid",
      AIRJAM_BROWSER_WORKER_PORT: "8080",
    }),
  );
});

test("preserves supported host, executable and headless configuration", () => {
  const env = loadBrowserWorkerEnv({
    ...valid,
    AIRJAM_BROWSER_WORKER_HOST: "127.0.0.1",
    AIRJAM_BROWSER_WORKER_EXECUTABLE_PATH: "/usr/bin/chromium",
    AIRJAM_BROWSER_WORKER_HEADLESS: "false",
  });
  assert.equal(env.host, "127.0.0.1");
  assert.equal(env.executablePath, "/usr/bin/chromium");
  assert.equal(env.headless, false);
});
