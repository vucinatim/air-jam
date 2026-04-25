import assert from "node:assert/strict";
import test from "node:test";
import {
  AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY,
  isLocalDevControlSurfaceRuntimeMode,
  isLocalDevControlSurfaceTopology,
  parseRuntimeTopology,
  parseRuntimeTopologyFromSearchParams,
  readRuntimeTopologyFromEnv,
  readRuntimeTopologyFromWindow,
  resolveProjectRuntimeTopology,
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
  serializeRuntimeTopology,
} from "./index.mjs";

test("resolveRuntimeTopology defaults socket origin to backend origin without a proxy", () => {
  const topology = resolveRuntimeTopology({
    runtimeMode: "standalone-dev",
    surfaceRole: "host",
    appOrigin: "http://127.0.0.1:5173",
    backendOrigin: "http://127.0.0.1:4000",
    publicHost: "http://192.168.0.10:5173",
  });

  assert.equal(topology.socketOrigin, "http://127.0.0.1:4000");
  assert.equal(topology.proxyStrategy, "none");
  assert.equal(topology.assetBasePath, "/");
  assert.equal(topology.secureTransport, false);
});

test("resolveRuntimeTopology defaults socket origin to app origin for proxy modes", () => {
  const topology = resolveRuntimeTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "platform-controller",
    appOrigin: "https://localhost:3000",
    backendOrigin: "http://127.0.0.1:4000",
    proxyStrategy: "platform-proxy",
  });

  assert.equal(topology.socketOrigin, "https://localhost:3000");
});

test("embedded runtime requires a parent origin", () => {
  assert.throws(() =>
    resolveRuntimeTopology({
      runtimeMode: "arcade-live",
      surfaceRole: "host",
      appOrigin: "https://localhost:5173",
      backendOrigin: "http://127.0.0.1:4000",
      embedded: true,
    }),
  );
});

test("topology serializes to and from search params", () => {
  const topology = resolveRuntimeTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "controller",
    appOrigin: "https://localhost:3000",
    backendOrigin: "http://127.0.0.1:4000",
    publicHost: "https://192.168.0.33:3000",
    assetBasePath: "/airjam-local-builds/pong",
    embedded: true,
    embedParentOrigin: "https://localhost:3000",
    proxyStrategy: "none",
  });

  const params = new URLSearchParams(runtimeTopologyToQueryParams(topology));
  const reparsed = parseRuntimeTopologyFromSearchParams(params);

  assert.deepEqual(reparsed, topology);
});

test("topology serializes to and from JSON", () => {
  const topology = resolveRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "host",
    appOrigin: "https://play.example.com",
    backendOrigin: "https://api.example.com",
  });

  assert.deepEqual(
    parseRuntimeTopology(serializeRuntimeTopology(topology)),
    topology,
  );
});

test("readRuntimeTopologyFromEnv reads the first populated canonical env key", () => {
  const serialized = serializeRuntimeTopology({
    runtimeMode: "standalone-secure",
    surfaceRole: "controller",
    appOrigin: "https://192.168.0.33:5173",
    backendOrigin: "http://127.0.0.1:4000",
    publicHost: "https://192.168.0.33:5173",
  });

  const topology = readRuntimeTopologyFromEnv({
    VITE_AIR_JAM_RUNTIME_TOPOLOGY: serialized,
  });

  assert.equal(topology?.runtimeMode, "standalone-secure");
  assert.equal(topology?.surfaceRole, "controller");
});

test("readRuntimeTopologyFromWindow reads the explicit window bootstrap payload", () => {
  const topology = readRuntimeTopologyFromWindow({
    [AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY]: {
      runtimeMode: "hosted-release",
      surfaceRole: "host",
      appOrigin: "https://play.example.com",
      backendOrigin: "https://api.example.com",
      publicHost: "https://play.example.com",
      assetBasePath: "/releases/g/game-1/r/release-1",
      secureTransport: true,
      embedded: false,
      proxyStrategy: "none",
    },
  });

  assert.deepEqual(topology, {
    runtimeMode: "hosted-release",
    surfaceRole: "host",
    appOrigin: "https://play.example.com",
    backendOrigin: "https://api.example.com",
    socketOrigin: "https://api.example.com",
    publicHost: "https://play.example.com",
    assetBasePath: "/releases/g/game-1/r/release-1",
    secureTransport: true,
    embedded: false,
    proxyStrategy: "none",
  });
});

test("resolveProjectRuntimeTopology defaults standalone dev to dev-proxy", () => {
  const topology = resolveProjectRuntimeTopology({
    surfaceRole: "host",
    appOrigin: "http://192.168.0.20:5173",
    backendOrigin: "http://127.0.0.1:4000",
  });

  assert.equal(topology.runtimeMode, "standalone-dev");
  assert.equal(topology.proxyStrategy, "dev-proxy");
  assert.equal(topology.socketOrigin, "http://192.168.0.20:5173");
});

test("resolveProjectRuntimeTopology defaults production projects to direct backend only when requested", () => {
  const topology = resolveProjectRuntimeTopology({
    runtimeMode: "self-hosted-production",
    surfaceRole: "controller",
    appOrigin: "https://play.example.com",
    backendOrigin: "https://api.example.com",
  });

  assert.equal(topology.proxyStrategy, "none");
  assert.equal(topology.socketOrigin, "https://api.example.com");
});

test("local dev control surfaces only auto-enable on local runtime modes", () => {
  assert.equal(isLocalDevControlSurfaceRuntimeMode("standalone-dev"), true);
  assert.equal(isLocalDevControlSurfaceRuntimeMode("arcade-built"), true);
  assert.equal(
    isLocalDevControlSurfaceRuntimeMode("self-hosted-production"),
    false,
  );
  assert.equal(isLocalDevControlSurfaceRuntimeMode("hosted-release"), false);

  assert.equal(
    isLocalDevControlSurfaceTopology({
      runtimeMode: "standalone-secure",
    }),
    true,
  );
  assert.equal(
    isLocalDevControlSurfaceTopology({
      runtimeMode: "hosted-release",
    }),
    false,
  );
});
