import {
  buildEmbeddedGameTopology,
  buildPlatformShellTopology,
  buildSecureGameEnv,
  buildStandaloneGameTopology,
  detectLocalIpv4,
  loadEnvFile,
  loadSecureDevState,
  resolveRequestedSecureMode,
  SECURE_MODE_LOCAL,
  SECURE_MODE_TUNNEL,
  serializeResolvedTopology,
} from "@air-jam/cli/development";
import { readDocumentationSnapshot } from "@air-jam/cli/documentation";
import { createAirJamViteConfig } from "@air-jam/cli/vite-config";
import { inspectProject } from "@air-jam/devtools/context";
import { listGames } from "@air-jam/devtools/games";
import {
  capturePrefabAtRuntime,
  definePrefabCaptureHarness,
  loadPrefabCapture,
} from "@air-jam/devtools/harness/visual";
import {
  captureVisualsAtRuntime,
  listVisualScenarios,
} from "@air-jam/devtools/visual";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const documentation = await readDocumentationSnapshot();
assert.equal(documentation.documents.length, 16);
assert.ok(
  documentation.documents.some(
    (document) =>
      document.page.href === "/docs/sdk/ui-components" &&
      document.content.includes("@air-jam/sdk/ui"),
  ),
);
const viteConfig = createAirJamViteConfig({
  env: {},
  port: 4317,
  profile: "three",
});
assert.equal(viteConfig.server.port, 4317);
assert.equal(viteConfig.preview.strictPort, true);
assert.equal(
  viteConfig.build.rollupOptions?.output.manualChunks(
    "/node_modules/zod/index.js",
  ),
  "airjam-sdk",
);
const prefabs = definePrefabCaptureHarness({
  gameId: "consumer",
  prefabs: [{ id: "arena", prefabId: "arena", buildHostUrl: (url) => url }],
});
assert.equal(prefabs.prefabs[0].id, "arena");
assert.equal(typeof loadPrefabCapture, "function");
assert.equal(typeof capturePrefabAtRuntime, "function");
const games = await listGames();
assert.equal(games.length, 1);
assert.ok(games[0].configPath?.endsWith("src/airjam.config.ts"));
const visualScenarios = await listVisualScenarios();
assert.equal(typeof captureVisualsAtRuntime, "function");
assert.deepEqual(
  visualScenarios.scenarios.map((scenario) => scenario.scenarioId),
  ["installed-library"],
);
const developmentRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "airjam-dev-api-"),
);
try {
  fs.writeFileSync(
    path.join(developmentRoot, "package.json"),
    JSON.stringify({
      name: "air-jam-product",
      dependencies: { "@air-jam/sdk": "0.9.3" },
      airjam: {
        workspace: { cli: "scripts/repo/cli.mjs", modes: ["standalone-dev"] },
      },
    }),
  );
  fs.writeFileSync(
    path.join(developmentRoot, "pnpm-workspace.yaml"),
    "packages: [games/*]\n",
  );
  fs.mkdirSync(path.join(developmentRoot, "scripts/repo"), { recursive: true });
  fs.writeFileSync(
    path.join(developmentRoot, "scripts/repo/cli.mjs"),
    "export {};\n",
  );
  const project = await inspectProject({ cwd: developmentRoot });
  assert.equal(project.context.mode, "monorepo");
  assert.equal(project.context.packageJson?.name, "air-jam-product");
  const environment: NodeJS.ProcessEnv = { EXISTING: "shell" };
  const environmentFile = path.join(developmentRoot, ".env");
  fs.writeFileSync(environmentFile, "EXISTING=file\nFROM_FILE=value\n");
  loadEnvFile(environmentFile, environment);
  assert.deepEqual(environment, { EXISTING: "shell", FROM_FILE: "value" });
  assert.equal(resolveRequestedSecureMode({ env: {} }), SECURE_MODE_LOCAL);
  assert.throws(
    () => loadSecureDevState({ cwd: developmentRoot, mode: SECURE_MODE_LOCAL }),
    /Missing .airjam\/secure-dev.json/u,
  );
  const certificateFile = path.join(developmentRoot, "certificate.pem");
  const keyFile = path.join(developmentRoot, "key.pem");
  fs.writeFileSync(certificateFile, "test fixture; not a TLS certificate");
  fs.writeFileSync(keyFile, "test fixture; not a TLS key");
  fs.mkdirSync(path.join(developmentRoot, ".airjam"));
  fs.writeFileSync(
    path.join(developmentRoot, ".airjam/secure-dev.json"),
    JSON.stringify({
      version: 1,
      mode: SECURE_MODE_LOCAL,
      generatedAt: new Date().toISOString(),
      lanIp: detectLocalIpv4(),
      certFile: certificateFile,
      keyFile,
      hosts: ["localhost"],
      tunnelHost: "https://dev.example.test",
      tunnelName: "fixture",
    }),
  );
  const secureState = loadSecureDevState({
    cwd: developmentRoot,
    mode: SECURE_MODE_TUNNEL,
    env: {},
    gamePort: 5432,
  });
  assert.equal(secureState.publicHost, "https://dev.example.test");
  assert.equal(secureState.loopbackHost, "https://127.0.0.1:5432");
  const secureEnvironment = buildSecureGameEnv({
    secureState,
    backendOrigin: "http://127.0.0.1:4321",
  });
  assert.equal(secureEnvironment.AIR_JAM_DEV_CERT_FILE, certificateFile);
  const topology = buildStandaloneGameTopology({
    surfaceRole: "host",
    publicHost: secureState.publicHost,
    secureTransport: true,
    backendOrigin: "http://127.0.0.1:4321",
  });
  assert.equal(
    serializeResolvedTopology(topology),
    secureEnvironment.VITE_AIR_JAM_RUNTIME_TOPOLOGY,
  );
  const shell = buildPlatformShellTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "platform-host",
    appOrigin: "http://localhost:3000",
    publicHost: "http://localhost:3000",
  });
  const embedded = buildEmbeddedGameTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "host",
    runtimeUrl: "http://localhost:3000/airjam-local-builds/pong",
    publicHost: "http://localhost:3000",
    embedParentOrigin: "http://localhost:3000",
  });
  assert.equal(shell.proxyStrategy, "platform-proxy");
  assert.equal(embedded.assetBasePath, "/airjam-local-builds/pong");
  fs.unlinkSync(keyFile);
  assert.throws(
    () =>
      loadSecureDevState({ cwd: developmentRoot, mode: SECURE_MODE_TUNNEL }),
    /Missing local HTTPS certificate files/u,
  );
} finally {
  fs.rmSync(developmentRoot, { recursive: true, force: true });
}
const toolContract = JSON.parse(
  fs.readFileSync(
    new URL(import.meta.resolve("@air-jam/mcp-server/tool-contract")),
    "utf8",
  ),
);
assert.ok(toolContract["standalone-game"].includes("airjam.open_game_session"));
console.log(
  JSON.stringify({
    harnessContract: true,
    gameInspection: true,
    shippedHelperExecution: true,
    developmentApi: true,
    productWorkspaceDetection: true,
    mcpToolContract: true,
    viteConfiguration: true,
    documentationSnapshot: true,
    documentationPageCount: documentation.documents.length,
  }),
);
