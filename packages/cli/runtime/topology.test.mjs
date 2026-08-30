import assert from "node:assert/strict";
import test from "node:test";

import { resolveProjectSurfaceTopology } from "./topology.mjs";

test("standalone topology advertises the configured Vite port", () => {
  const topology = resolveProjectSurfaceTopology({
    runtimeMode: "standalone-dev",
    secure: false,
    env: {
      VITE_PORT: "53417",
    },
    surfaceRole: "host",
    cwd: process.cwd(),
  });

  assert.equal(new URL(topology.appOrigin).port, "53417");
  assert.equal(new URL(topology.publicHost).port, "53417");
  assert.equal(new URL(topology.socketOrigin).port, "53417");
});

test("standalone topology treats an empty Vite port as unconfigured", () => {
  const topology = resolveProjectSurfaceTopology({
    runtimeMode: "standalone-dev",
    secure: false,
    env: { VITE_PORT: "" },
    surfaceRole: "host",
    cwd: process.cwd(),
  });

  assert.equal(new URL(topology.appOrigin).port, "5173");
});
