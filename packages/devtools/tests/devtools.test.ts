import type {
  ClientToServerEvents,
  ControllerActionRpcPayload,
  ControllerInputEvent,
  ControllerStateSyncRequestPayload,
  ServerToClientEvents,
} from "@air-jam/sdk/protocol";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { createServer, get as httpGet } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server as SocketIoServer } from "socket.io";
import { afterEach, describe, expect, it } from "vitest";
import { inspectGameAgentContract } from "../src/agent.js";
import { detectProjectContext, inspectProject } from "../src/context.js";
import {
  connectController,
  controlControllerParticipant,
  disconnectController,
  invokeControllerAction,
  readRuntimeSnapshot,
  sendControllerInput,
} from "../src/controller.js";
import {
  getDevStatus,
  getTopology,
  resetLocalDev,
  startDev,
  stopDev,
} from "../src/dev.js";
import { createGameSessionRuntime } from "../src/game-session-runtime.js";
import {
  inspectGame,
  listGames,
  listVisualCaptureSummaries,
  readVisualCaptureSummary,
} from "../src/games.js";
import {
  AIR_JAM_COMPLETE_EVALUATION_GATES,
  runCompleteEvaluation,
  runQualityGate,
} from "../src/quality.js";
import type { AirJamVisualCaptureSummary } from "../src/types.js";
import { listVisualScenarios } from "../src/visual.js";
import {
  declarationSource,
  testingSource,
} from "./game-declaration-fixture.js";
const {
  closeGameSession,
  invokeGameSessionAction,
  openGameSession,
  readGameSession,
  sendGameSessionInput,
} = createGameSessionRuntime();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempRoots: string[] = [];
const fixtureClosers: Array<() => Promise<void>> = [];
const originalFetch = globalThis.fetch;
const originalKnownPortsEnv = process.env.AIRJAM_DEVTOOLS_KNOWN_PORTS;

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-devtools-"));
  tempRoots.push(root);
  return root;
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  if (
    path.basename(filePath) === "package.json" &&
    value &&
    typeof value === "object"
  )
    value = { packageManager: "pnpm@9.9.0", ...value };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const getAvailablePort = async (): Promise<number> =>
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("No test port was allocated.")));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });

const waitForHttpOk = async (
  port: number,
  timeoutMs = 5_000,
): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ok = await new Promise<boolean>((resolve) => {
      const request = httpGet(`http://127.0.0.1:${port}`, (response) => {
        response.resume();
        resolve(true);
      });
      request.on("error", () => resolve(false));
      request.setTimeout(250, () => {
        request.destroy();
        resolve(false);
      });
    });
    if (ok) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for test HTTP listener on ${port}.`);
};

const waitForHttpClosed = async (
  port: number,
  timeoutMs = 5_000,
): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const open = await new Promise<boolean>((resolve) => {
      const request = httpGet(`http://127.0.0.1:${port}`, (response) => {
        response.resume();
        resolve(true);
      });
      request.on("error", () => resolve(false));
      request.setTimeout(250, () => {
        request.destroy();
        resolve(false);
      });
    });
    if (!open) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for test HTTP listener ${port} to stop.`);
};

const createStandaloneDevFixture = async (): Promise<{
  root: string;
  port: number;
}> => {
  const root = await createTempRoot();
  const port = await getAvailablePort();
  await writeJson(path.join(root, "package.json"), {
    name: "solo-fixture",
    type: "module",
    scripts: {
      dev: "node dev.mjs",
      topology: "node topology.mjs",
    },
    dependencies: {
      "@air-jam/sdk": "^1.0.0",
    },
  });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src", "airjam.config.ts"),
    declarationSource(
      { slug: "solo-fixture" },
      'testing: "./game/contracts/visual-scenarios.mjs"',
    ),
    "utf8",
  );
  await writeFile(
    path.join(root, "dev.mjs"),
    `import http from "node:http";

const port = ${port};
const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", \`http://127.0.0.1:\${port}\`);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (url.pathname === "/controller") {
    response.end(\`<!doctype html><html><body><main>controller</main></body></html>\`);
    return;
  }

  response.end(\`<!doctype html>
  <html>
    <body>
      <main>host</main>
    </body>
  </html>\`);
});

server.listen(port, "127.0.0.1");

const shutdown = () => {
  server.close(() => process.exit(0));
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
`,
    "utf8",
  );
  await writeFile(
    path.join(root, "topology.mjs"),
    `const port = ${port};
console.log(JSON.stringify({
  mode: "standalone-dev",
  secure: false,
  surfaces: {
    host: {
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: \`http://127.0.0.1:\${port}\`,
      backendOrigin: \`http://127.0.0.1:\${port}\`,
      publicHost: \`http://127.0.0.1:\${port}\`
    },
    controller: {
      runtimeMode: "standalone-dev",
      surfaceRole: "controller",
      appOrigin: \`http://127.0.0.1:\${port}\`,
      backendOrigin: \`http://127.0.0.1:\${port}\`,
      publicHost: \`http://127.0.0.1:\${port}\`
    }
  }
}, null, 2));
`,
    "utf8",
  );
  await mkdir(path.join(root, "src", "game", "contracts"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "src", "game", "contracts", "visual-scenarios.mjs"),
    testingSource(`profiles: {}, visual: {
  scenarios: [
    {
      id: "lobby",
      description: "Fixture lobby state",
      run: async () => {},
    },
  ],
}`),
    "utf8",
  );

  return { root, port };
};

const createControllerSocketFixture = async ({
  controllerStateDelayMs = 0,
  rejectLeave = false,
  aliasedAgentImport = false,
  replayStaleDefaultSyncAfterAction = false,
  embeddedArcadeIdentity = null,
}: {
  controllerStateDelayMs?: number;
  rejectLeave?: boolean;
  aliasedAgentImport?: boolean;
  replayStaleDefaultSyncAfterAction?: boolean;
  embeddedArcadeIdentity?: {
    epoch: number;
    gameId: string;
  } | null;
} = {}): Promise<{
  root: string;
  joinUrl: string;
  receivedInputs: ControllerInputEvent[];
  receivedActions: ControllerActionRpcPayload[];
  receivedStateSyncRequests: ControllerStateSyncRequestPayload[];
  receivedLeaves: { roomId: string; controllerId: string }[];
  setStorePayload: (
    storeDomain: string,
    payload: Record<string, unknown>,
  ) => void;
}> => {
  const root = await createTempRoot();
  await writeJson(path.join(root, "package.json"), {
    name: "socket-fixture",
    type: "module",
    scripts: {
      topology: "node topology.mjs",
    },
    dependencies: {
      "@air-jam/sdk": "^1.0.0",
    },
  });
  await mkdir(path.join(root, "src"), { recursive: true });
  if (aliasedAgentImport) {
    // The caller's project root has no alias configuration. The helper must
    // discover the tsconfig belonging to the authored config and contract.
    await writeJson(path.join(root, "src", "tsconfig.json"), {
      compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } },
    });
  }
  await writeFile(
    path.join(root, "src", "airjam.config.ts"),
    declarationSource(
      { slug: "socket-fixture" },
      "agent: agentContract",
      `import { agentContract } from "${aliasedAgentImport ? "@/game/contracts/agent" : "./game/contracts/agent"}";`,
    ),
    "utf8",
  );
  await mkdir(path.join(root, "src", "game", "contracts"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "src", "game", "contracts", "agent.ts"),
    `export const agentContract = {
  stores: {
    default: {},
  },
  snapshotDescription: "Fixture game snapshot for devtools tests.",
  projectSnapshot: ({ stores, controllerId }) => {
    const state = stores.default ?? {};
    return {
      phase: state.phase ?? null,
      score: state.score ?? null,
      controllerId,
    };
  },
  actions: {
    set_score: {
      target: {
        kind: "participant",
        actionName: "setScore",
        storeDomain: "default",
      },
      description: "Set the score from a numeric payload.",
      input: {
        parse: (payload) => {
          const score = Number(payload);
          if (!Number.isFinite(score)) {
            throw new Error("expected a finite number payload");
          }
          return score;
        },
        metadata: {
          payload: {
            kind: "number",
            description: "The score to send.",
          },
        },
      },
      toPayload: (score) => ({
          score,
      }),
      resultDescription: "The score action is routed to the host.",
    },
    finish_match: {
      target: {
        kind: "host",
        actionName: "finishMatch",
        storeDomain: "default",
      },
      description: "Finish the active match immediately.",
      input: {
        parse: () => undefined,
        metadata: {
          payload: {
            kind: "none",
            description: null,
          },
        },
      },
      resultDescription: "The fixture snapshot moves to ended.",
    },
  },
};
`,
    "utf8",
  );
  await mkdir(path.join(root, "visual"), { recursive: true });
  await writeFile(
    path.join(root, "visual", "scenarios.mjs"),
    testingSource(`profiles: {}, visual: {
  scenarios: [
    {
      id: "lobby",
      description: "Socket fixture lobby state",
      run: async () => {},
    },
  ],
}`),
    "utf8",
  );

  const receivedInputs: ControllerInputEvent[] = [];
  const receivedActions: ControllerActionRpcPayload[] = [];
  const receivedStateSyncRequests: ControllerStateSyncRequestPayload[] = [];
  const receivedLeaves: { roomId: string; controllerId: string }[] = [];
  const embeddedGameStoreDomain = embeddedArcadeIdentity
    ? `aj.embedded.game:${embeddedArcadeIdentity.epoch}:${embeddedArcadeIdentity.gameId}`
    : null;
  const storePayloads = new Map<string, Record<string, unknown>>([
    [embeddedGameStoreDomain ?? "default", { phase: "lobby", score: 3 }],
    ["scoreboard", { home: 3, away: 1 }],
    ...(embeddedArcadeIdentity
      ? [
          [
            "arcade.surface",
            {
              epoch: embeddedArcadeIdentity.epoch,
              kind: "game",
              gameId: embeddedArcadeIdentity.gameId,
              controllerUrl: "http://localhost:5173/controller",
              orientation: "portrait",
              overlay: "hidden",
            },
          ] as const,
        ]
      : []),
  ]);
  const storeRevisions = new Map<string, number>(
    Array.from(storePayloads.keys(), (storeDomain) => [storeDomain, 0]),
  );

  const httpServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><html><body>controller fixture</body></html>");
  });
  const io = new SocketIoServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: "*",
      },
    },
  );

  io.on("connection", (socket) => {
    socket.on("controller:join", (payload, callback) => {
      callback({
        ok: true,
        controllerId: payload.controllerId,
        roomId: payload.roomId,
      });
      socket.emit("server:welcome", {
        controllerId: payload.controllerId,
        roomId: payload.roomId,
        player: {
          id: payload.controllerId,
          label: payload.nickname ?? payload.controllerId,
          avatarId: payload.avatarId,
        },
        players: [
          {
            id: payload.controllerId,
            label: payload.nickname ?? payload.controllerId,
            avatarId: payload.avatarId,
          },
        ],
      });
      const publishState = () =>
        socket.emit("server:state", {
          roomId: payload.roomId,
          state: {
            orientation: "landscape",
            runtimeState: "playing",
            stateVersion: 1,
          },
        });
      if (controllerStateDelayMs > 0)
        setTimeout(publishState, controllerStateDelayMs);
      else publishState();
    });

    socket.on("controller:leasedControl", (request, acknowledge) => {
      acknowledge({
        status: "applied",
        leaseId: request.lease.id,
        sequence: request.lease.sequence,
        replayed: false,
        operation:
          request.operation.kind === "action"
            ? {
                kind: "action",
                result: { ok: true, status: "accepted", source: "host" },
              }
            : { kind: request.operation.kind },
      });
    });

    socket.on("controller:input", (payload) => {
      receivedInputs.push(payload);
    });

    (
      socket as unknown as {
        on: (
          event: string,
          listener: (
            payload: {
              roomId: string;
              actionName: string;
              payload: ControllerActionRpcPayload["payload"];
              storeDomain: string;
            },
            callback?: (ack: {
              ok: true;
              status: "accepted";
              source: "host";
            }) => void,
          ) => void,
        ) => void;
      }
    ).on("controller:action_rpc", (payload, callback) => {
      receivedActions.push(payload);
      if (
        payload.actionName === "setScore" &&
        replayStaleDefaultSyncAfterAction
      ) {
        const previous = { ...storePayloads.get(payload.storeDomain) };
        const revision = storeRevisions.get(payload.storeDomain) ?? 0;
        storePayloads.set(payload.storeDomain, { ...previous, score: 9 });
        storeRevisions.set(payload.storeDomain, revision + 1);
        setTimeout(
          () =>
            socket.emit("airjam:state_sync", {
              roomId: payload.roomId,
              storeDomain: payload.storeDomain,
              data: previous,
              revision,
            }),
          50,
        );
      }
      callback?.({
        ok: true,
        status: "accepted",
        source: "host",
      });
    });

    socket.on("controller:state_sync_request", (payload) => {
      receivedStateSyncRequests.push(payload);
      const data = storePayloads.get(payload.storeDomain);
      if (!data) {
        return;
      }

      socket.emit("airjam:state_sync", {
        roomId: payload.roomId,
        storeDomain: payload.storeDomain,
        data,
        revision: storeRevisions.get(payload.storeDomain) ?? 0,
        ...(payload.requestId ? { requestId: payload.requestId } : {}),
      });
    });

    (
      socket as unknown as {
        on: (
          event: string,
          listener: (
            payload: { roomId: string; controllerId: string },
            callback: (ack: { ok: boolean; message?: string }) => void,
          ) => void,
        ) => void;
      }
    ).on("controller:leave", (payload, callback) => {
      receivedLeaves.push(payload);
      if (rejectLeave) {
        callback({ ok: false, message: "The fixture refused removal." });
        return;
      }
      socket.emit("server:controllerLeft", {
        controllerId: payload.controllerId,
      });
      callback({ ok: true });
    });
  });

  const port = await new Promise<number>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve controller socket fixture port."));
        return;
      }
      resolve(address.port);
    });
  });

  await writeFile(
    path.join(root, "topology.mjs"),
    `const port = ${port};
console.log(JSON.stringify({
  mode: "standalone-dev",
  secure: false,
  surfaces: {
    host: {
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: \`http://127.0.0.1:\${port}\`,
      backendOrigin: \`http://127.0.0.1:\${port}\`,
      publicHost: \`http://127.0.0.1:\${port}\`
    },
    controller: {
      runtimeMode: "standalone-dev",
      surfaceRole: "controller",
      appOrigin: \`http://127.0.0.1:\${port}\`,
      backendOrigin: \`http://127.0.0.1:\${port}\`,
      publicHost: \`http://127.0.0.1:\${port}\`
    }
  }
}, null, 2));
`,
    "utf8",
  );

  fixtureClosers.push(async () => {
    await new Promise<void>((resolve, reject) => {
      io.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  return {
    root,
    joinUrl: `http://127.0.0.1:${port}/controller?room=ROOM1&aj_controller_cap=cap_fixture`,
    receivedInputs,
    receivedActions,
    receivedStateSyncRequests,
    receivedLeaves,
    setStorePayload: (storeDomain, payload) => {
      storePayloads.set(storeDomain, payload);
      storeRevisions.set(
        storeDomain,
        (storeRevisions.get(storeDomain) ?? 0) + 1,
      );
    },
  };
};

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalKnownPortsEnv === undefined) {
    delete process.env.AIRJAM_DEVTOOLS_KNOWN_PORTS;
  } else {
    process.env.AIRJAM_DEVTOOLS_KNOWN_PORTS = originalKnownPortsEnv;
  }
  while (fixtureClosers.length > 0) {
    const close = fixtureClosers.pop();
    await close?.();
  }
  await Promise.all(
    tempRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("detectProjectContext", () => {
  it("detects the Air Jam monorepo from the repository root", async () => {
    const context = await detectProjectContext({
      cwd: path.resolve(__dirname, "../../.."),
    });

    expect(context.mode).toBe("monorepo");
    expect(context.packageJson?.name).toBe("air-jam");
    expect(context.workspaceRoot).toBe(context.rootDir);
    expect(context.reasons.join(" ")).toContain(
      "declared Air Jam workspace CLI",
    );
  });

  it("detects the Air Jam monorepo from a nested repo game directory", async () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const canonicalRepoRoot = await realpath(repoRoot);
    const context = await detectProjectContext({
      cwd: path.join(repoRoot, "games", "pong"),
    });

    expect(context.mode).toBe("monorepo");
    expect(context.rootDir).toBe(canonicalRepoRoot);
    expect(context.workspaceRoot).toBe(canonicalRepoRoot);
    expect(context.packageManager).toBe("pnpm");
  });

  it("detects a standalone game fixture", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "space-race",
      type: "module",
      scripts: {
        dev: "airjam dev",
        test: "vitest run",
      },
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "airjam.config.ts"),
      'export const airjam = { controllerPath: "/controller" };\n',
      "utf8",
    );

    const context = await detectProjectContext({ cwd: root });

    expect(context.mode).toBe("standalone-game");
    expect(context.rootDir).toBe(await realpath(root));
    expect(context.workspaceRoot).toBeNull();
    expect(context.packageJson?.name).toBe("space-race");
  });
});

describe("inspectProject", () => {
  it("returns capabilities and Air Jam packages for a standalone project", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "solo-game",
      scripts: {
        build: "vite build",
      },
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
      devDependencies: {
        "@air-jam/mcp-server": "^1.0.0",
      },
    });
    await writeFile(path.join(root, "AGENTS.md"), "# Agents\n", "utf8");

    const project = await inspectProject({ cwd: root });

    expect(project.context.mode).toBe("standalone-game");
    expect(project.capabilities).toEqual([
      "project",
      "games",
      "logs",
      "runtime",
      "quality",
      "ai-pack",
    ]);
    expect(project.airJamPackages["@air-jam/sdk"]).toBe("^1.0.0");
    expect(project.airJamPackages["@air-jam/mcp-server"]).toBe("^1.0.0");
    expect(project.files.agents).toBe(
      path.join(await realpath(root), "AGENTS.md"),
    );
  });
});

describe("listGames and inspectGame", () => {
  it("lists repo games from the monorepo manifests", async () => {
    const games = await listGames({ cwd: path.resolve(__dirname, "../../..") });

    expect(games.map((game) => game.id)).toContain("air-capture");
    expect(games.map((game) => game.id)).toContain("pong");
    expect(games.every((game) => game.manifestPath)).toBe(true);
  }, 60_000);

  it("inspects the declared repo game", async () => {
    const game = await inspectGame({
      cwd: path.resolve(__dirname, "../../.."),
      gameId: "pong",
    });

    expect(game.id).toBe("pong");
    expect(game.configPath).toMatch(/src\/airjam\.config\.ts$/);
    expect(game.declaration.metadata.slug).toBe("pong");
    expect(game.declaration.controllerPath).toBe("/controller");
    expect(game).not.toHaveProperty("visual");
    expect(game.qualityGates).toContain("typecheck");
    expect(game.qualityGates).toContain("release-check");
  });

  it("lists the current game in standalone mode", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "solo-game",
      scripts: {
        typecheck: "tsc --noEmit",
        test: "vitest run",
      },
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "airjam.config.ts"),
      declarationSource({ slug: "solo-game" }, 'controllerPath: "/phone"'),
      "utf8",
    );

    const games = await listGames({ cwd: root });
    const game = await inspectGame({ cwd: root });

    expect(games).toHaveLength(1);
    expect(game.id).toBe("solo-game");
    expect(game.declaration.controllerPath).toBe("/phone");
    expect(game.qualityGates).toEqual(["typecheck", "test"]);
  });
});

describe("visual capture summaries", () => {
  const createCaptureFixture = async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "air-jam-product",
      dependencies: { "@air-jam/sdk": "0.9.3" },
      airjam: {
        workspace: { cli: "scripts/repo/cli.mjs", modes: ["standalone-dev"] },
      },
    });
    await writeFile(
      path.join(root, "pnpm-workspace.yaml"),
      "packages: [games/*]\n",
    );
    await mkdir(path.join(root, "scripts/repo"), { recursive: true });
    await writeFile(path.join(root, "scripts/repo/cli.mjs"), "export {};\n");
    await writeJson(path.join(root, "games/pong/package.json"), {
      name: "pong",
    });
    await writeJson(path.join(root, "games/pong/airjam-template.json"), {
      scaffold: true,
    });
    await mkdir(path.join(root, "games/pong/src"), { recursive: true });
    await writeFile(
      path.join(root, "games/pong/src/airjam.config.ts"),
      declarationSource({ slug: "pong", name: "Pong" }),
    );
    await writeJson(
      path.join(root, ".airjam/artifacts/visual/pong/capture-summary.json"),
      {
        gameId: "pong",
        mode: "standalone-dev",
        secure: false,
        capturedAt: "2026-10-08T00:00:00.000Z",
        scenarios: [
          {
            scenarioId: "fixture",
            status: "captured",
            screenshotCount: 1,
            relativeDir: "fixture",
          },
        ],
      } satisfies AirJamVisualCaptureSummary,
    );
    return root;
  };

  it("reads an existing repo visual capture summary", async () => {
    const root = await createCaptureFixture();
    const capture = await readVisualCaptureSummary({
      cwd: root,
      gameId: "pong",
    });

    expect(capture.gameId).toBe("pong");
    expect(capture.summary.scenarios.length).toBeGreaterThan(0);
  });

  it("lists available repo visual capture summaries", async () => {
    const root = await createCaptureFixture();
    const captures = await listVisualCaptureSummaries({
      cwd: root,
    });

    expect(captures.map((capture) => capture.gameId)).toEqual(["pong"]);
  });
});

describe("runQualityGate", () => {
  it("rejects repo-only gates in standalone mode", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "solo-game",
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });

    await expect(
      runQualityGate({ cwd: root, gate: "release-check" }),
    ).rejects.toThrow(/only available in the Air Jam monorepo/);
  });
});

describe("runCompleteEvaluation", () => {
  it("runs the canonical four game gates and reports one stable result", async () => {
    const root = await createTempRoot();
    const passingScript = `${JSON.stringify(process.execPath)} -e "process.exit(0)"`;
    await writeJson(path.join(root, "package.json"), {
      name: "evaluation-fixture",
      dependencies: { "@air-jam/sdk": "^1.0.0" },
      scripts: {
        typecheck: passingScript,
        lint: passingScript,
        test: passingScript,
        build: passingScript,
      },
    });

    const evaluation = await runCompleteEvaluation({ cwd: root });

    expect(evaluation.contract).toBe("air-jam-complete-evaluation/v1");
    expect(evaluation.status).toBe("passed");
    expect(evaluation.gates.map(({ gate }) => gate)).toEqual(
      AIR_JAM_COMPLETE_EVALUATION_GATES,
    );
    expect(evaluation.gates.every(({ result }) => result.ok)).toBe(true);
  });
});

describe("dev lifecycle and topology", () => {
  it("resolves monorepo topology through the owning repo CLI", async () => {
    const repoRoot = path.resolve(__dirname, "../../..");

    const topology = await getTopology({
      cwd: repoRoot,
      gameId: "pong",
      mode: "standalone-dev",
    });

    expect(topology.projectMode).toBe("monorepo");
    expect(topology.gameId).toBe("pong");
    expect(topology.topologyMode).toBe("standalone-dev");
    if (topology.urls.hostUrl === null)
      throw new Error("Missing standalone host URL.");
    const hostUrl = new URL(topology.urls.hostUrl);
    expect(hostUrl.protocol).toBe("http:");
    expect(hostUrl.port).toBe("5173");
    expect(hostUrl.pathname).toBe("/");
    expect(topology.urls.localBuildUrl).toBeNull();
  }, 30_000);

  it.each([
    ["standalone-dev", "standalone:dev", "standalone-dev"],
    ["arcade-dev", "arcade:dev", "arcade-live"],
    ["arcade-test", "arcade:test", "arcade-built"],
  ] as const)(
    "starts and inspects a declared %s workspace without root SDK dependencies",
    async (mode, startCommand, topologyMode) => {
      const root = await createTempRoot();
      const port = await getAvailablePort();
      await writeJson(path.join(root, "package.json"), {
        name: "air-jam-product",
        type: "module",
        airjam: {
          workspace: {
            cli: "workspace.mjs",
            modes: ["standalone-dev", "arcade-dev", "arcade-test"],
          },
        },
      });
      await writeFile(
        path.join(root, "pnpm-workspace.yaml"),
        "packages: [games/*]\n",
      );
      await writeJson(path.join(root, "games/pong/airjam-template.json"), {
        scaffold: true,
      });
      await mkdir(path.join(root, "games/pong/src"), { recursive: true });
      await writeFile(
        path.join(root, "games/pong/src/airjam.config.ts"),
        declarationSource({ slug: "pong", name: "Pong" }),
      );
      await writeJson(path.join(root, "games/pong/package.json"), {
        name: "pong",
      });
      await writeJson(
        path.join(root, "games/air-capture/airjam-template.json"),
        { scaffold: true },
      );
      await mkdir(path.join(root, "games/air-capture/src"), {
        recursive: true,
      });
      await writeFile(
        path.join(root, "games/air-capture/src/airjam.config.ts"),
        declarationSource({
          slug: "air-capture",
          name: "Zebra reference game",
        }),
      );
      await writeFile(
        path.join(root, "workspace.mjs"),
        `import http from "node:http";
const [family, command, ...args] = process.argv.slice(2);
if (family !== "workspace" || !args.includes("--game=pong")) throw new Error("Invalid repo command");
const origin = "http://127.0.0.1:${port}";
if (command === "topology") {
  if (!args.includes("--mode=${topologyMode}")) throw new Error("Invalid topology mode");
  console.log(JSON.stringify({ surfaces: {
    host: { runtimeMode: "standalone-dev", surfaceRole: "host", appOrigin: origin, backendOrigin: origin, publicHost: origin },
    controller: { runtimeMode: "standalone-dev", surfaceRole: "controller", appOrigin: origin, backendOrigin: origin, publicHost: origin },
    platformHost: { appOrigin: origin, publicHost: origin },
    platformController: { appOrigin: origin, publicHost: origin },
    embeddedHost: { assetBasePath: "/games/pong" }
  }}));
} else if (command === "${startCommand}") {
  const server = http.createServer((_request, response) => response.end("ready"));
  server.listen(${port}, "127.0.0.1");
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
} else throw new Error("Unknown repo command");
`,
      );
      const context = await detectProjectContext({
        cwd: path.join(root, "games/pong"),
      });
      expect(context.mode).toBe("monorepo");
      expect(context.packageJson?.name).toBe("air-jam-product");
      const started = await startDev({ cwd: root, mode });
      try {
        expect(started.process.args).toEqual([
          path.join(await realpath(root), "workspace.mjs"),
          "workspace",
          startCommand,
          "--game=pong",
        ]);
        expect(started.topology.topologyMode).toBe(topologyMode);
        if (!started.topology.urls.hostUrl)
          throw new Error("Missing host surface URL.");
        expect(new URL(started.topology.urls.hostUrl).origin).toBe(
          `http://127.0.0.1:${port}`,
        );
        expect(new URL(started.topology.urls.hostUrl).pathname).toBe(
          mode === "standalone-dev" ? "/" : "/arcade/local-pong",
        );
        expect(
          (await getTopology({ cwd: root, gameId: "pong", mode })).projectMode,
        ).toBe("monorepo");
      } finally {
        await stopDev({ cwd: root, processId: started.process.id });
      }
      await waitForHttpClosed(port);
    },
    30_000,
  );

  it("rejects undeclared workspace modes before inspecting games or starting a process", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      dependencies: { "@air-jam/sdk": "0.9.3" },
      airjam: {
        workspace: { cli: "workspace.mjs", modes: ["standalone-dev"] },
      },
    });
    await writeFile(
      path.join(root, "workspace.mjs"),
      'throw new Error("must not run");\n',
    );
    for (const mode of ["arcade-dev", "arcade-test"] as const) {
      await expect(startDev({ cwd: root, mode })).rejects.toThrow(
        `Mode "${mode}" is not supported by this project. Supported modes: standalone-dev.`,
      );
      await expect(getTopology({ cwd: root, mode })).rejects.toThrow(
        `Mode "${mode}" is not supported by this project. Supported modes: standalone-dev.`,
      );
    }
    expect((await getDevStatus({ cwd: root })).processes).toEqual([]);
  });

  it("does not infer a workspace from an unrelated repo CLI", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      dependencies: { "@air-jam/sdk": "0.9.3" },
    });
    await mkdir(path.join(root, "scripts/repo"), { recursive: true });
    await writeFile(path.join(root, "scripts/repo/cli.mjs"), "export {};\n");
    await writeFile(
      path.join(root, "pnpm-workspace.yaml"),
      "packages: [games/*]\n",
    );
    expect((await detectProjectContext({ cwd: root })).mode).toBe(
      "standalone-game",
    );
  });

  it("fails clearly when the declared workspace CLI is missing", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      airjam: { workspace: { cli: "missing.mjs", modes: ["standalone-dev"] } },
    });
    await expect(detectProjectContext({ cwd: root })).rejects.toThrow(
      "Declared Air Jam workspace CLI does not exist: missing.mjs",
    );
  });

  it("starts, reports, and stops a managed standalone dev process", async () => {
    const { root, port } = await createStandaloneDevFixture();

    const started = await startDev({ cwd: root });

    try {
      if (
        !started.topology.urls.hostUrl ||
        !started.topology.urls.controllerBaseUrl
      )
        throw new Error("Missing standalone surface URLs.");
      expect(started.reusedExistingProcess).toBe(false);
      expect(started.process.mode).toBe("standalone-dev");
      expect(new URL(started.topology.urls.hostUrl).origin).toBe(
        `http://127.0.0.1:${port}`,
      );
      expect(new URL(started.topology.urls.controllerBaseUrl).pathname).toBe(
        "/controller",
      );
      expect(
        new URL(started.topology.urls.controllerBaseUrl).searchParams.get(
          "aj_topology_surface_role",
        ),
      ).toBe("controller");

      const status = await getDevStatus({ cwd: root });
      expect(status.processes).toHaveLength(1);
      expect(status.processes[0]?.id).toBe(started.process.id);
      expect(status.knownPorts).toEqual(expect.arrayContaining([4000, 5173]));
      expect(Array.isArray(status.unmanagedProcesses)).toBe(true);

      const topology = await getTopology({ cwd: root });
      expect(topology.process?.id).toBe(started.process.id);
      if (!topology.urls.hostUrl) throw new Error("Missing host surface URL.");
      expect(new URL(topology.urls.hostUrl).origin).toBe(
        `http://127.0.0.1:${port}`,
      );
    } finally {
      await stopDev({ cwd: root, processId: started.process.id });
    }

    const statusAfterStop = await getDevStatus({ cwd: root });
    expect(statusAfterStop.processes).toHaveLength(0);
    await waitForHttpClosed(port);
  }, 30_000);

  it("reports an early managed runtime exit without waiting for the topology timeout", async () => {
    const { root } = await createStandaloneDevFixture();
    await writeFile(
      path.join(root, "dev.mjs"),
      'console.error("fixture managed runtime failed");\nprocess.exit(7);\n',
      "utf8",
    );

    const startedAt = Date.now();
    // pnpm can normalize the script's exit code; the supervisor reports its managed command.
    await expect(startDev({ cwd: root })).rejects.toThrow(
      /Managed dev supervisor exited with code [1-9]\d*[\s\S]*fixture managed runtime failed/,
    );
    expect(Date.now() - startedAt).toBeLessThan(10_000);

    const status = await getDevStatus({ cwd: root });
    expect(status.processes).toHaveLength(0);
  });

  it("reports and resets unmanaged known-port local dev listeners", async () => {
    const root = await createTempRoot();
    const port = await getAvailablePort();
    process.env.AIRJAM_DEVTOOLS_KNOWN_PORTS = String(port);
    await writeJson(path.join(root, "package.json"), {
      name: "unmanaged-dev-listener-fixture",
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });
    const scriptPath = path.join(root, "fixture-vite-listener.mjs");
    await writeFile(
      scriptPath,
      `import http from "node:http";
const port = Number(process.argv[2]);
const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("ok");
});
server.listen(port, "127.0.0.1");
const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
`,
      "utf8",
    );

    const child = spawn(process.execPath, [scriptPath, String(port)], {
      cwd: root,
      detached: true,
      stdio: "ignore",
    });
    fixtureClosers.push(async () => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    });

    await waitForHttpOk(port);

    const status = await getDevStatus({ cwd: root });
    expect(status.knownPorts).toEqual([port]);
    expect(status.unmanagedProcesses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pid: child.pid,
          ports: [port],
          managed: false,
        }),
      ]),
    );

    const reset = await resetLocalDev({ cwd: root });
    expect(reset.knownPorts).toEqual([port]);
    expect(reset.stoppedUnmanaged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pid: child.pid,
          ports: [port],
        }),
      ]),
    );
  });
});

describe("visual scenarios", () => {
  it("does not publish visual scenarios for repo games by default", async () => {
    await expect(
      listVisualScenarios({
        cwd: path.resolve(__dirname, "../../.."),
        gameId: "pong",
      }),
    ).rejects.toThrow(/No visual scenarios declared/);
  }, 30_000);

  it("lists explicitly published visual scenarios for an internal fixture", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "published-visual-fixture",
      type: "module",
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });
    await mkdir(path.join(root, "src", "game", "contracts"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "src", "airjam.config.ts"),
      declarationSource(
        { slug: "published-visual-fixture" },
        'testing: "./game/contracts/visual-scenarios.ts"',
      ),
      "utf8",
    );
    await writeFile(
      path.join(root, "src", "game", "contracts", "visual-scenarios.ts"),
      testingSource(
        "profiles: {}, visual: { scenarios: [{ id: 'lobby', description: 'Lobby state', run: async () => {} }] }",
      ),
      "utf8",
    );

    const scenarios = await listVisualScenarios({
      cwd: root,
    });

    expect(scenarios.gameId).toBe("published-visual-fixture");
    expect(scenarios.configPath).toMatch(/src\/airjam\.config\.ts$/);
    expect(scenarios.scenarios.map((scenario) => scenario.scenarioId)).toEqual([
      "lobby",
    ]);
  });

  it("does not fall back to visual scenario files when config does not publish them", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "unpublished-visual-fixture",
      type: "module",
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "visual"), { recursive: true });
    await writeFile(
      path.join(root, "src", "airjam.config.ts"),
      declarationSource(),
      "utf8",
    );
    await writeFile(
      path.join(root, "visual", "scenarios.ts"),
      "export const visualScenarios = { agent: {}, scenarios: [] };\n",
      "utf8",
    );

    await expect(listVisualScenarios({ cwd: root })).rejects.toThrow(
      /No visual scenarios declared/,
    );
  });
});

describe("virtual controller runtime control", () => {
  it("keeps leased player ownership separate from ordinary controller writes", async () => {
    const fixture = await createControllerSocketFixture();
    const connected = await connectController({
      cwd: fixture.root,
      controllerJoinUrl: fixture.joinUrl,
    });
    const command = {
      controllerSessionId: connected.controllerSessionId,
      expected: {
        documentId: "document",
        roomId: "ROOM1",
        contractId: "contract",
        runtimeId: "runtime",
        surfaceId: null,
        participantId: null,
      },
      lease: { id: "223e4567-e89b-42d3-a456-426614174000", sequence: 1 },
      operation: { kind: "release" as const },
    };
    try {
      expect(await controlControllerParticipant(command)).toMatchObject({
        status: "applied",
        operation: { kind: "release" },
      });
      await expect(
        sendControllerInput({
          controllerSessionId: connected.controllerSessionId,
          input: {},
        }),
      ).rejects.toThrow("participant_control_leased");
      await expect(
        invokeControllerAction({
          controllerSessionId: connected.controllerSessionId,
          actionName: "tap",
          storeDomain: "default",
        }),
      ).rejects.toThrow("participant_control_leased");
      expect(
        await controlControllerParticipant({
          ...command,
          lease: {
            ...command.lease,
            id: "223e4567-e89b-42d3-a456-426614174001",
          },
        }),
      ).toEqual({ status: "rejected", reason: "lease_conflict" });
      expect(
        await controlControllerParticipant({
          ...command,
          lease: { ...command.lease, sequence: 2 },
          operation: {
            kind: "action",
            deadlineMs: performance.now() + 2000,
            actionId: "tap",
          },
        }),
      ).toMatchObject({
        status: "applied",
        operation: { kind: "action", result: { ok: true } },
      });
      expect(fixture.receivedInputs).toEqual([]);
      expect(fixture.receivedActions).toEqual([]);
    } finally {
      const stopped = await disconnectController({
        controllerSessionId: connected.controllerSessionId,
      });
      expect(stopped.release).toMatchObject({
        status: "applied",
        sequence: 3,
        operation: { kind: "release" },
      });
      expect(stopped.leave).toEqual({ status: "acknowledged" });
    }
  });

  it("reports an unremoved player honestly while still disconnecting its socket", async () => {
    const fixture = await createControllerSocketFixture({ rejectLeave: true });
    const connected = await connectController({
      cwd: fixture.root,
      controllerJoinUrl: fixture.joinUrl,
    });
    const stopped = await disconnectController({
      controllerSessionId: connected.controllerSessionId,
    });
    expect(stopped.disconnected).toBe(true);
    expect(stopped.release).toEqual({ status: "not-leased" });
    expect(stopped.leave).toEqual({
      status: "rejected",
      message: "The fixture refused removal.",
    });
    expect(stopped.session.connected).toBe(false);
  });

  it("connects a virtual controller, sends input, invokes actions, reads synced runtime state, and disconnects", async () => {
    const fixture = await createControllerSocketFixture({
      controllerStateDelayMs: 50,
    });

    const connected = await connectController({
      cwd: fixture.root,
      controllerJoinUrl: fixture.joinUrl,
      nickname: "DevCtrl",
      avatarId: "aj-2",
    });

    expect(connected.roomId).toBe("ROOM1");
    expect(connected.connected).toBe(true);
    expect(connected.controllerState?.runtimeState).toBe("playing");
    expect(connected.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: connected.controllerId,
          label: "DevCtrl",
          avatarId: "aj-2",
        }),
      ]),
    );

    const inputResult = await sendControllerInput({
      controllerSessionId: connected.controllerSessionId,
      input: { confirm: true, direction: 0.5 },
    });
    await sendControllerInput({
      controllerSessionId: connected.controllerSessionId,
      input: { confirm: false },
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(inputResult.controllerId).toBe(connected.controllerId);
    // A button an agent puts down is one press; other controls hold.
    expect(fixture.receivedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: "ROOM1",
          controllerId: connected.controllerId,
          input: { confirm: { down: true, presses: 1 }, direction: 0.5 },
        }),
        expect.objectContaining({
          input: { confirm: { down: false, presses: 1 }, direction: 0.5 },
        }),
      ]),
    );

    const actionResult = await invokeControllerAction({
      controllerSessionId: connected.controllerSessionId,
      actionName: "joinTeam",
      storeDomain: "default",
      payload: {
        team: "blue",
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(actionResult.actionName).toBe("joinTeam");
    expect(actionResult.acknowledgement).toEqual({
      ok: true,
      status: "accepted",
      source: "host",
    });
    expect(fixture.receivedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: "ROOM1",
          actionName: "joinTeam",
          storeDomain: "default",
          payload: {
            team: "blue",
          },
        }),
      ]),
    );

    const runtimeSnapshot = await readRuntimeSnapshot({
      controllerSessionId: connected.controllerSessionId,
      storeDomains: ["default", "scoreboard"],
      requestSync: true,
      timeoutMs: 1_000,
    });
    expect(runtimeSnapshot.requestedStoreDomains).toEqual([
      "default",
      "scoreboard",
    ]);
    expect(runtimeSnapshot.missingStoreDomains).toEqual([]);
    expect(runtimeSnapshot.storeSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storeDomain: "default",
          data: {
            phase: "lobby",
            score: 3,
          },
        }),
        expect.objectContaining({
          storeDomain: "scoreboard",
          data: {
            home: 3,
            away: 1,
          },
        }),
      ]),
    );
    expect(fixture.receivedStateSyncRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: "ROOM1",
          storeDomain: "default",
        }),
        expect.objectContaining({
          roomId: "ROOM1",
          storeDomain: "scoreboard",
        }),
      ]),
    );

    const disconnected = await disconnectController({
      controllerSessionId: connected.controllerSessionId,
    });
    expect(disconnected.disconnected).toBe(true);
    expect(disconnected.leave).toEqual({ status: "acknowledged" });
    expect(disconnected.session.connected).toBe(false);
    expect(fixture.receivedLeaves).toEqual([
      expect.objectContaining({
        roomId: "ROOM1",
        controllerId: connected.controllerId,
      }),
    ]);

    await expect(
      readRuntimeSnapshot({
        controllerSessionId: connected.controllerSessionId,
      }),
    ).rejects.toThrow(/Unknown Air Jam controller session/);
  });
});

describe("agent contracts", () => {
  it("inspects a repo agent contract", async () => {
    const contract = await inspectGameAgentContract({
      cwd: path.resolve(__dirname, "../../.."),
      gameId: "last-band-standing",
    });

    expect(contract.hasContract).toBe(true);
    expect(contract.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "set_ready",
          target: expect.objectContaining({
            actionName: "setReady",
          }),
        }),
        expect.objectContaining({
          actionId: "submit_guess",
          target: expect.objectContaining({
            actionName: "submitGuess",
          }),
        }),
      ]),
    );
  });

  it("inspects a second repo agent contract", async () => {
    const contract = await inspectGameAgentContract({
      cwd: path.resolve(__dirname, "../../.."),
      gameId: "pong",
    });

    expect(contract.hasContract).toBe(true);
    expect(contract.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: "join_team",
          target: expect.objectContaining({
            actionName: "joinTeam",
          }),
        }),
        expect.objectContaining({
          actionId: "award_point",
          target: expect.objectContaining({
            actionName: "scorePoint",
          }),
        }),
      ]),
    );
  });

  it.each([false, true])(
    "inspects source contracts with project-local aliases: %s",
    async (aliasedAgentImport) => {
      const fixture = await createControllerSocketFixture({
        aliasedAgentImport,
      });
      const contract = await inspectGameAgentContract({ cwd: fixture.root });
      expect(contract.source).toBe("source-declaration");
      expect(
        contract.actions.some((action) => action.actionId === "set_score"),
      ).toBe(true);
    },
  );

  it("does not infer an agent contract from a file that config does not publish", async () => {
    const root = await createTempRoot();
    await writeJson(path.join(root, "package.json"), {
      name: "unpublished-agent-fixture",
      type: "module",
      dependencies: {
        "@air-jam/sdk": "^1.0.0",
      },
    });
    await mkdir(path.join(root, "src", "game", "contracts"), {
      recursive: true,
    });
    await writeFile(
      path.join(root, "src", "airjam.config.ts"),
      declarationSource(),
      "utf8",
    );
    await writeFile(
      path.join(root, "src", "game", "contracts", "agent.ts"),
      `export const agentContract = {
  stores: {
    default: {},
  },
  projectSnapshot: ({ stores }) => stores.default ?? {},
  actions: {},
};\n`,
      "utf8",
    );

    const contract = await inspectGameAgentContract({ cwd: root });

    expect(contract.hasContract).toBe(false);
    expect(contract.actions).toEqual([]);
  });
});

describe("attached game sessions", () => {
  it("retains participant input but refuses semantic interpretation of local source", async () => {
    const fixture = await createControllerSocketFixture();
    const session = await openGameSession({
      cwd: fixture.root,
      controllerJoinUrl: fixture.joinUrl,
    });
    expect(session.hasAgentContract).toBe(false);
    expect(session.actions).toEqual([]);
    await sendGameSessionInput({
      gameSessionId: session.gameSessionId,
      input: { moveX: 1 },
    });
    await expect(
      readGameSession({ gameSessionId: session.gameSessionId }),
    ).rejects.toThrow("contract_runtime_not_owned");
    await expect(
      invokeGameSessionAction({
        gameSessionId: session.gameSessionId,
        actionId: "player:set_score",
        payload: 9,
      }),
    ).rejects.toThrow("contract_runtime_not_owned");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(fixture.receivedInputs).toHaveLength(1);
    expect(fixture.receivedActions).toHaveLength(0);
    await closeGameSession({ gameSessionId: session.gameSessionId });
  });
  it("keeps built-package attachments participant-only", async () => {
    const fixture = await createControllerSocketFixture();
    const built = await import(
      `${pathToFileURL(path.join(__dirname, "../dist/game-session.js")).href}?built-session-smoke`
    );
    const session = await built.openGameSession({
      cwd: fixture.root,
      controllerJoinUrl: fixture.joinUrl,
    });
    expect(session.hasAgentContract).toBe(false);
    expect(session.actions).toEqual([]);
    await built.closeGameSession({
      cwd: fixture.root,
      gameSessionId: session.gameSessionId,
    });
    const { stopGameSessionBroker } =
      await import("../src/game-session-broker.js");
    await stopGameSessionBroker(fixture.root);
  });
  it("does not accept a stale Arcade game identity", async () => {
    const fixture = await createControllerSocketFixture();
    await expect(
      openGameSession({
        cwd: fixture.root,
        gameId: "stale",
        mode: "arcade-dev",
        controllerJoinUrl: fixture.joinUrl,
        timeoutMs: 50,
      }),
    ).rejects.toThrow('did not expose a valid "arcade.surface" snapshot');
    expect(fixture.receivedLeaves).toHaveLength(1);
  });
});
