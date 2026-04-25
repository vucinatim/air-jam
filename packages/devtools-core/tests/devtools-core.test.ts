import type {
  ClientToServerEvents,
  ControllerActionRpcPayload,
  ControllerInputEvent,
  ControllerStateSyncRequestPayload,
  ServerToClientEvents,
} from "@air-jam/sdk/protocol";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server as SocketIoServer } from "socket.io";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  connectController,
  detectProjectContext,
  disconnectController,
  getDevStatus,
  getTopology,
  inspectGame,
  inspectGameAgentContract,
  inspectProject,
  invokeControllerAction,
  invokeGameAction,
  invokeHarnessAction,
  listGames,
  listHarnessSessions,
  listVisualCaptureSummaries,
  listVisualScenarios,
  readGameSnapshot,
  readHarnessSnapshot,
  readRuntimeSnapshot,
  readVisualCaptureSummary,
  runQualityGate,
  sendControllerInput,
  startDev,
  stopDev,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempRoots: string[] = [];
const fixtureClosers: Array<() => Promise<void>> = [];
const originalFetch = globalThis.fetch;

const createTempRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "airjam-devtools-"));
  tempRoots.push(root);
  return root;
};

const writeJson = async (filePath: string, value: unknown): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const createStandaloneDevFixture = async (): Promise<{
  root: string;
  port: number;
}> => {
  const root = await createTempRoot();
  const port = 43251;
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
    'export const airjam = { game: { controllerPath: "/controller", machine: { visualScenariosModule: "../visual/scenarios.mjs" } } };\n',
    "utf8",
  );
  await writeFile(
    path.join(root, "dev.mjs"),
    `import http from "node:http";

const port = ${port};
const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", \`http://127.0.0.1:\${port}\`);
  const controllerJoinUrl = \`http://127.0.0.1:\${port}/controller?room=fixture-room\`;

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  if (url.pathname === "/controller") {
    response.end(\`<!doctype html><html><body><main>controller</main></body></html>\`);
    return;
  }

  response.end(\`<!doctype html>
  <html>
    <body>
      <main>host</main>
      <script>
        const snapshot = {
          roomId: "fixture-room",
          controllerJoinUrl: "\${controllerJoinUrl}",
          matchPhase: "lobby",
          runtimeState: "idle",
          updatedAt: new Date().toISOString(),
        };

        window.__airJamVisualHarness = snapshot;
        window.__airJamVisualHarnessActions = {
          setMatchPhase(payload) {
            const phase =
              typeof payload === "string"
                ? payload
                : payload && typeof payload.phase === "string"
                  ? payload.phase
                  : null;
            window.__airJamVisualHarness = {
              ...window.__airJamVisualHarness,
              matchPhase: phase,
              updatedAt: new Date().toISOString(),
            };
            return window.__airJamVisualHarness;
          },
          endMatch() {
            window.__airJamVisualHarness = {
              ...window.__airJamVisualHarness,
              matchPhase: "ended",
              runtimeState: "stopped",
              updatedAt: new Date().toISOString(),
            };
            return { ok: true };
          },
        };
      </script>
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
      publicHost: \`http://127.0.0.1:\${port}\`
    },
    controller: {
      runtimeMode: "standalone-dev",
      surfaceRole: "controller",
      appOrigin: \`http://127.0.0.1:\${port}\`,
      publicHost: \`http://127.0.0.1:\${port}\`
    }
  }
}, null, 2));
`,
    "utf8",
  );
  await mkdir(path.join(root, "visual"), { recursive: true });
  await writeFile(
    path.join(root, "visual", "scenarios.mjs"),
    `export const harness = {
  gameId: "solo-fixture",
  bridge: {
    gameId: "solo-fixture",
    actions: {
      setMatchPhase: {},
      endMatch: {},
    },
  },
  scenarios: [
    {
      id: "lobby",
      description: "Fixture lobby state",
      run: async () => {},
    },
  ],
};
`,
    "utf8",
  );

  return { root, port };
};

const createControllerSocketFixture = async (): Promise<{
  root: string;
  joinUrl: string;
  receivedInputs: ControllerInputEvent[];
  receivedActions: ControllerActionRpcPayload[];
  receivedStateSyncRequests: ControllerStateSyncRequestPayload[];
  receivedLeaves: { roomId: string; controllerId: string }[];
}> => {
  const root = await createTempRoot();
  await writeJson(path.join(root, "package.json"), {
    name: "socket-fixture",
    type: "module",
    dependencies: {
      "@air-jam/sdk": "^1.0.0",
    },
  });
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "src", "airjam.config.ts"),
    'import { gameAgentContract } from "./game/contracts/agent";\nexport const airjam = { game: { controllerPath: "/controller", machine: { agent: gameAgentContract } } };\n',
    "utf8",
  );
  await mkdir(path.join(root, "src", "game", "contracts"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "src", "game", "contracts", "agent.ts"),
    `export const gameAgentContract = {
  gameId: "socket-fixture",
  snapshotStoreDomains: ["default"],
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
        kind: "controller",
        actionName: "setScore",
        storeDomain: "default",
      },
      description: "Set the score from a numeric payload.",
      payload: {
        kind: "number",
        description: "The score to send.",
      },
      resolveInput: (input) => ({
        score: Number(input),
      }),
      resultDescription: "The score action is routed to the host.",
    },
  },
};
`,
    "utf8",
  );

  const receivedInputs: ControllerInputEvent[] = [];
  const receivedActions: ControllerActionRpcPayload[] = [];
  const receivedStateSyncRequests: ControllerStateSyncRequestPayload[] = [];
  const receivedLeaves: { roomId: string; controllerId: string }[] = [];
  const storePayloads = new Map<string, Record<string, unknown>>([
    ["default", { phase: "lobby", score: 3 }],
    ["scoreboard", { home: 3, away: 1 }],
  ]);

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
      socket.emit("server:state", {
        roomId: payload.roomId,
        state: {
          orientation: "landscape",
          runtimeState: "playing",
          stateVersion: 1,
        },
      });
    });

    socket.on("controller:input", (payload) => {
      receivedInputs.push(payload);
    });

    socket.on("controller:action_rpc", (payload) => {
      receivedActions.push(payload);
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
      });
    });

    (
      socket as unknown as {
        on: (
          event: string,
          listener: (
            payload: { roomId: string; controllerId: string },
            callback: (ack: { ok: true }) => void,
          ) => void,
        ) => void;
      }
    ).on("controller:leave", (payload, callback) => {
      receivedLeaves.push(payload);
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
  };
};

afterEach(async () => {
  globalThis.fetch = originalFetch;
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
    expect(context.reasons.join(" ")).toContain("monorepo");
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
      'export const gameMetadata = {}; export const airjam = { game: { controllerPath: "/controller" } };\n',
      "utf8",
    );

    const context = await detectProjectContext({ cwd: root });

    expect(context.mode).toBe("standalone-game");
    expect(context.rootDir).toBe(root);
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
      "visual",
      "quality",
      "ai-pack",
    ]);
    expect(project.airJamPackages["@air-jam/sdk"]).toBe("^1.0.0");
    expect(project.airJamPackages["@air-jam/mcp-server"]).toBe("^1.0.0");
    expect(project.files.agents).toBe(path.join(root, "AGENTS.md"));
  });
});

describe("listGames and inspectGame", () => {
  it("lists repo games from the monorepo manifests", async () => {
    const games = await listGames({ cwd: path.resolve(__dirname, "../../..") });

    expect(games.map((game) => game.id)).toContain("air-capture");
    expect(games.map((game) => game.id)).toContain("pong");
    expect(games.every((game) => game.manifestPath)).toBe(true);
  });

  it("inspects a repo game without loading its TypeScript config", async () => {
    const game = await inspectGame({
      cwd: path.resolve(__dirname, "../../.."),
      gameId: "pong",
    });

    expect(game.id).toBe("pong");
    expect(game.configPath).toMatch(/src\/airjam\.config\.ts$/);
    expect(game.metadataExportLikely).toBe(true);
    expect(game.controllerPathLikely).toBe("/controller");
    expect(game.visual.hasContract).toBe(true);
    expect(game.qualityGates).toContain("typecheck");
    expect(game.qualityGates).toContain("release-check");
  });

  it("does not infer visual machine support from a file that config does not publish", async () => {
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
      'export const airjam = { game: { controllerPath: "/controller" } };\n',
      "utf8",
    );
    await writeFile(
      path.join(root, "visual", "scenarios.ts"),
      "export const visualHarness = { gameId: 'unpublished-visual-fixture', bridge: { gameId: 'unpublished-visual-fixture', actions: {} }, scenarios: [] };\n",
      "utf8",
    );

    const game = await inspectGame({ cwd: root });

    expect(game.visual.hasContract).toBe(false);
    expect(game.visual.hasScenarios).toBe(false);
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
      'export const airjam = { game: { controllerPath: "/phone" } };\n',
      "utf8",
    );

    const games = await listGames({ cwd: root });
    const game = await inspectGame({ cwd: root });

    expect(games).toHaveLength(1);
    expect(game.id).toBe("solo-game");
    expect(game.controllerPathLikely).toBe("/phone");
    expect(game.qualityGates).toEqual(["typecheck", "test"]);
  });
});

describe("visual capture summaries", () => {
  it("reads an existing repo visual capture summary", async () => {
    const capture = await readVisualCaptureSummary({
      cwd: path.resolve(__dirname, "../../.."),
      gameId: "pong",
    });

    expect(capture.gameId).toBe("pong");
    expect(capture.summary.scenarios.length).toBeGreaterThan(0);
  });

  it("lists available repo visual capture summaries", async () => {
    const captures = await listVisualCaptureSummaries({
      cwd: path.resolve(__dirname, "../../.."),
    });

    expect(captures.map((capture) => capture.gameId)).toContain("pong");
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

describe("dev lifecycle and topology", () => {
  it("resolves monorepo topology through the shared runtime CLI", async () => {
    const repoRoot = path.resolve(__dirname, "../../..");

    const topology = await getTopology({
      cwd: repoRoot,
      gameId: "pong",
      mode: "arcade-test",
    });

    expect(topology.projectMode).toBe("monorepo");
    expect(topology.gameId).toBe("pong");
    expect(topology.topologyMode).toBe("arcade-built");
    expect(topology.urls.hostUrl).toContain("/arcade/local-pong");
    expect(topology.urls.localBuildUrl).toContain("/airjam-local-builds/pong");
  });

  it("starts, reports, and stops a managed standalone dev process", async () => {
    const { root, port } = await createStandaloneDevFixture();

    const started = await startDev({ cwd: root });

    try {
      expect(started.reusedExistingProcess).toBe(false);
      expect(started.process.mode).toBe("standalone-dev");
      expect(started.topology.urls.hostUrl).toBe(`http://127.0.0.1:${port}`);
      expect(started.topology.urls.controllerBaseUrl).toBe(
        `http://127.0.0.1:${port}/controller`,
      );

      const status = await getDevStatus({ cwd: root });
      expect(status.processes).toHaveLength(1);
      expect(status.processes[0]?.id).toBe(started.process.id);

      const topology = await getTopology({ cwd: root });
      expect(topology.process?.id).toBe(started.process.id);
      expect(topology.urls.hostUrl).toBe(`http://127.0.0.1:${port}`);
    } finally {
      await stopDev({ cwd: root, processId: started.process.id });
    }

    const statusAfterStop = await getDevStatus({ cwd: root });
    expect(statusAfterStop.processes).toHaveLength(0);
  });
});

describe("visual scenarios", () => {
  it("lists game-owned visual scenarios for a repo game", async () => {
    const scenarios = await listVisualScenarios({
      cwd: path.resolve(__dirname, "../../.."),
      gameId: "pong",
    });

    expect(scenarios.gameId).toBe("pong");
    expect(scenarios.hasBridgeActions).toBe(true);
    expect(scenarios.scenarioModulePath).toMatch(/visual\/scenarios\.ts$/);
    expect(scenarios.bridgeActions).toEqual(
      expect.arrayContaining(["setPointsToWin", "scorePoint"]),
    );
    expect(scenarios.actionMetadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "setPointsToWin",
          payload: expect.objectContaining({
            kind: "number",
          }),
        }),
        expect.objectContaining({
          name: "scorePoint",
          payload: expect.objectContaining({
            kind: "enum",
            allowedValues: ["team1", "team2"],
          }),
        }),
      ]),
    );
    expect(scenarios.scenarios.map((scenario) => scenario.scenarioId)).toEqual(
      expect.arrayContaining(["lobby", "playing", "ended"]),
    );
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
      'export const airjam = { game: { controllerPath: "/controller" } };\n',
      "utf8",
    );
    await writeFile(
      path.join(root, "visual", "scenarios.ts"),
      "export const visualHarness = { gameId: 'unpublished-visual-fixture', bridge: { gameId: 'unpublished-visual-fixture', actions: {} }, scenarios: [] };\n",
      "utf8",
    );

    await expect(listVisualScenarios({ cwd: root })).rejects.toThrow(
      /No visual harness published/,
    );
  });
});

describe("harness runtime control", () => {
  it("reads the live harness snapshot and invokes a harness action", async () => {
    const { root } = await createStandaloneDevFixture();

    const started = await startDev({ cwd: root });

    try {
      const snapshot = await readHarnessSnapshot({
        cwd: root,
        timeoutMs: 15_000,
      });
      expect(snapshot.gameId).toBe("solo-fixture");
      expect(snapshot.availableActions).toEqual(
        expect.arrayContaining(["setMatchPhase", "endMatch"]),
      );
      expect(snapshot.snapshot?.matchPhase).toBe("lobby");
      expect(snapshot.urls.controllerJoinUrl).toContain("/controller?room=");
      expect(snapshot.roomId).toBeTruthy();

      const invocation = await invokeHarnessAction({
        cwd: root,
        roomId: snapshot.roomId ?? undefined,
        actionName: "setMatchPhase",
        payload: {
          phase: "playing",
        },
        timeoutMs: 15_000,
      });

      expect(invocation.actionName).toBe("setMatchPhase");
      expect(invocation.roomId).toBe(snapshot.roomId);
      expect(invocation.snapshotBefore?.matchPhase).toBe("lobby");
      expect(invocation.snapshotAfter?.matchPhase).toBe("playing");
    } finally {
      await stopDev({ cwd: root, processId: started.process.id });
    }
  }, 30_000);

  it("prefers registered live harness sessions over isolated browser sessions", async () => {
    const { root } = await createStandaloneDevFixture();
    const started = await startDev({ cwd: root });

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const href = String(input);
        if (href.includes("/__airjam/dev/harness/sessions")) {
          return new Response(
            JSON.stringify({
              sessions: [
                {
                  sessionId: "live-session",
                  gameId: "solo-fixture",
                  role: "host",
                  roomId: "ROOM1",
                  origin: "http://127.0.0.1:43251",
                  href: "http://127.0.0.1:43251/?room=ROOM1",
                  title: "Fixture",
                  actions: [
                    {
                      name: "setMatchPhase",
                      description: "Set the fixture match phase.",
                      payload: {
                        kind: "json",
                        description:
                          "Object payload with a phase string field.",
                      },
                      resultDescription: "The fixture snapshot updates.",
                    },
                  ],
                  actionNames: ["setMatchPhase"],
                  snapshot: {
                    roomId: "ROOM1",
                    controllerJoinUrl:
                      "http://127.0.0.1:43251/controller?room=ROOM1",
                    matchPhase: "lobby",
                    runtimeState: "playing",
                    updatedAt: new Date().toISOString(),
                  },
                  registeredAt: new Date().toISOString(),
                  lastSeenAt: new Date().toISOString(),
                },
              ],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (href.endsWith("/__airjam/dev/harness/invoke")) {
          return new Response(
            JSON.stringify({
              session: {
                sessionId: "live-session",
                gameId: "solo-fixture",
                role: "host",
                roomId: "ROOM1",
                origin: "http://127.0.0.1:43251",
                href: "http://127.0.0.1:43251/?room=ROOM1",
                title: "Fixture",
                actions: [
                  {
                    name: "setMatchPhase",
                    description: "Set the fixture match phase.",
                    payload: {
                      kind: "json",
                      description: "Object payload with a phase string field.",
                    },
                    resultDescription: "The fixture snapshot updates.",
                  },
                ],
                actionNames: ["setMatchPhase"],
                snapshot: {
                  roomId: "ROOM1",
                  controllerJoinUrl:
                    "http://127.0.0.1:43251/controller?room=ROOM1",
                  matchPhase: "playing",
                  runtimeState: "playing",
                  updatedAt: new Date().toISOString(),
                },
                registeredAt: new Date().toISOString(),
                lastSeenAt: new Date().toISOString(),
              },
              invocation: {
                commandId: "command-1",
                completedAt: new Date().toISOString(),
                sessionId: "live-session",
                roomId: "ROOM1",
                gameId: "solo-fixture",
                actionName: "setMatchPhase",
                result: { ok: true },
                snapshotBefore: {
                  roomId: "ROOM1",
                  controllerJoinUrl:
                    "http://127.0.0.1:43251/controller?room=ROOM1",
                  matchPhase: "lobby",
                  runtimeState: "playing",
                  updatedAt: new Date().toISOString(),
                },
                snapshotAfter: {
                  roomId: "ROOM1",
                  controllerJoinUrl:
                    "http://127.0.0.1:43251/controller?room=ROOM1",
                  matchPhase: "playing",
                  runtimeState: "playing",
                  updatedAt: new Date().toISOString(),
                },
              },
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        throw new Error(`Unexpected fetch ${href} ${init?.method ?? "GET"}`);
      },
    );
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const sessions = await listHarnessSessions({ cwd: root });
      expect(sessions.sessions).toHaveLength(1);
      expect(sessions.sessions[0]?.sessionId).toBe("live-session");
      expect(sessions.sessions[0]?.actions[0]?.name).toBe("setMatchPhase");

      const snapshot = await readHarnessSnapshot({ cwd: root });
      expect(snapshot.controlSurface).toBe("registered-session");
      expect(snapshot.sessionId).toBe("live-session");
      expect(snapshot.snapshot?.matchPhase).toBe("lobby");
      expect(snapshot.actions[0]?.payload.kind).toBe("json");

      const invocation = await invokeHarnessAction({
        cwd: root,
        actionName: "setMatchPhase",
        payload: { phase: "playing" },
      });
      expect(invocation.controlSurface).toBe("registered-session");
      expect(invocation.sessionId).toBe("live-session");
      expect(invocation.snapshotAfter?.matchPhase).toBe("playing");
      expect(invocation.actions[0]?.name).toBe("setMatchPhase");
    } finally {
      await stopDev({ cwd: root, processId: started.process.id });
    }
  });
});

describe("virtual controller runtime control", () => {
  it("connects a virtual controller, sends input, invokes actions, reads synced runtime state, and disconnects", async () => {
    const fixture = await createControllerSocketFixture();

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
      input: {
        buttons: {
          confirm: true,
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(inputResult.controllerId).toBe(connected.controllerId);
    expect(fixture.receivedInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: "ROOM1",
          controllerId: connected.controllerId,
          input: {
            buttons: {
              confirm: true,
            },
          },
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

describe("game agent contracts", () => {
  it("inspects a repo game agent contract", async () => {
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

  it("inspects a second repo game agent contract", async () => {
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

  it("projects a game snapshot and invokes semantic game actions through a controller session", async () => {
    const fixture = await createControllerSocketFixture();

    const connected = await connectController({
      cwd: fixture.root,
      gameId: "socket-fixture",
      controllerJoinUrl: fixture.joinUrl,
      nickname: "AgentCtrl",
    });

    const projected = await readGameSnapshot({
      controllerSessionId: connected.controllerSessionId,
      requestSync: true,
      timeoutMs: 1_000,
    });
    expect(projected.snapshotStoreDomains).toEqual(["default"]);
    expect(projected.snapshot).toMatchObject({
      phase: "lobby",
      score: 3,
      controllerId: connected.controllerId,
    });

    const invoked = await invokeGameAction({
      controllerSessionId: connected.controllerSessionId,
      actionId: "set_score",
      payload: 7,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(invoked.actionId).toBe("set_score");
    expect(invoked.actionName).toBe("setScore");
    expect(invoked.storeDomain).toBe("default");
    expect(fixture.receivedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionName: "setScore",
          storeDomain: "default",
          payload: {
            score: 7,
          },
        }),
      ]),
    );

    await disconnectController({
      controllerSessionId: connected.controllerSessionId,
    });
  });

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
      'export const airjam = { game: { controllerPath: "/controller" } };\n',
      "utf8",
    );
    await writeFile(
      path.join(root, "src", "game", "contracts", "agent.ts"),
      `export const gameAgentContract = {
  gameId: "unpublished-agent-fixture",
  snapshotStoreDomains: ["default"],
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
