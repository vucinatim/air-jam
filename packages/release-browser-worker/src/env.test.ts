import assert from "node:assert/strict";
import test from "node:test";
import { loadBrowserWorkerEnv } from "./env";

test("loadBrowserWorkerEnv reads the optional access token", () => {
  const env = loadBrowserWorkerEnv({
    AIRJAM_BROWSER_WORKER_ACCESS_TOKEN: "preview-browser-token",
  });

  assert.equal(env.port, 8080);
  assert.equal(env.accessToken, "preview-browser-token");
  assert.equal(env.host, "0.0.0.0");
  assert.equal(env.headless, true);
  assert.equal(env.chromiumSandbox, false);
});
