import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectProjectContext,
  getDevStatus,
  getTopology,
  inspectGame,
  inspectProject,
  invokeHarnessAction,
  listGames,
  listHarnessSessions,
  listVisualCaptureSummaries,
  listVisualScenarios,
  readHarnessSnapshot,
  readVisualCaptureSummary,
  runQualityGate,
  startDev,
  stopDev,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempRoots: string[] = [];
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
    'export const airjam = { game: { controllerPath: "/controller" } };\n',
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

afterEach(async () => {
  globalThis.fetch = originalFetch;
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
