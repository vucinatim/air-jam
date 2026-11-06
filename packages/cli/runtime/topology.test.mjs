import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadCreateAirJamRuntimeEnv } from "./runtime-env.mjs";
import { getSecurePaths } from "./secure-dev.mjs";
import {
  resolveProjectSurfaceTopology,
  runProjectTopologyCli,
} from "./topology.mjs";

test("standalone topology consumes the validated numeric Vite port", () => {
  const env = loadCreateAirJamRuntimeEnv({
    env: { VITE_PORT: "53417", AIR_JAM_SERVER_PORT: "43400" },
    boundary: "create-airjam.topology-test",
  });
  const topology = resolveProjectSurfaceTopology({
    runtimeMode: "standalone-dev",
    secure: false,
    env,
    surfaceRole: "host",
    cwd: process.cwd(),
  });

  assert.equal(new URL(topology.appOrigin).port, "53417");
  assert.equal(new URL(topology.publicHost).port, "53417");
  assert.equal(new URL(topology.socketOrigin).port, "53417");
  assert.equal(topology.backendOrigin, "http://127.0.0.1:43400");
});

test("standalone topology consumes the validated default Vite port", () => {
  const env = loadCreateAirJamRuntimeEnv({
    env: { VITE_PORT: "" },
    boundary: "create-airjam.topology-test",
  });
  const topology = resolveProjectSurfaceTopology({
    runtimeMode: "standalone-dev",
    secure: false,
    env,
    surfaceRole: "host",
    cwd: process.cwd(),
  });

  assert.equal(new URL(topology.appOrigin).port, "5173");
});

test("secure standalone topology returns HTTPS surfaces from saved local setup", async (context) => {
  const cwd = path.resolve("topology-fixture");
  const paths = getSecurePaths(cwd);
  const files = new Map([
    [paths.certFile, "certificate"],
    [paths.keyFile, "key"],
    [
      paths.secureDevStateFile,
      JSON.stringify({
        version: 1,
        mode: "local",
        lanIp: null,
        certFile: paths.certFile,
        keyFile: paths.keyFile,
      }),
    ],
  ]);
  context.mock.method(fs, "existsSync", (filePath) => files.has(filePath));
  context.mock.method(fs, "readFileSync", (filePath) => {
    assert.ok(files.has(filePath), `Unexpected file read: ${filePath}`);
    return files.get(filePath);
  });
  context.mock.method(os, "networkInterfaces", () => ({}));
  let output = "";
  context.mock.method(process.stdout, "write", (chunk) => {
    output += chunk;
    return true;
  });

  await runProjectTopologyCli({
    cwd,
    argv: ["--mode=standalone-dev", "--secure"],
    env: { VITE_PORT: "53417", AIR_JAM_SERVER_PORT: "43400" },
  });

  const topology = JSON.parse(output);
  assert.equal(topology.mode, "standalone-dev");
  assert.equal(topology.secure, true);
  for (const surfaceRole of ["host", "controller"]) {
    assert.deepEqual(topology.surfaces[surfaceRole], {
      runtimeMode: "standalone-secure",
      surfaceRole,
      appOrigin: "https://localhost:53417",
      backendOrigin: "http://127.0.0.1:43400",
      socketOrigin: "https://localhost:53417",
      publicHost: "https://localhost:53417",
      assetBasePath: "/",
      secureTransport: true,
      embedded: false,
      proxyStrategy: "dev-proxy",
    });
  }
});
