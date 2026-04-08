import path from "node:path";
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  buildSecureGameEnv,
  DEFAULT_GAME_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import {
  buildStandaloneGameTopology,
  serializeResolvedTopology,
} from "../../../packages/create-airjam/runtime/runtime-topology.mjs";
import {
  defaultWorkspaceGameId,
  findRepoGame,
} from "./repo-games.mjs";
import {
  createWorkspaceProcessGroup,
  ensureWorkspacePackageBuild,
  findAvailablePort,
  reserveWorkspaceResources,
} from "./workspace-stack.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForUrl = async (url, label, timeoutMs = 120_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore transient startup failures while the stack boots.
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
};

export const startWorkspaceStandaloneLiveStack = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  secure = false,
  secureMode = SECURE_MODE_LOCAL,
} = {}) => {
  const activeGame = findRepoGame(gameId);
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }

  if (secure && secureMode !== SECURE_MODE_LOCAL) {
    throw new Error(
      "Tunnel secure mode is not supported for local standalone visual capture. Use local secure mode instead.",
    );
  }

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const processGroup = createWorkspaceProcessGroup({
    rootDir,
    exitOnShutdown: false,
  });

  const serverPort = await findAvailablePort();
  let gamePort = await findAvailablePort();
  while (gamePort === serverPort) {
    gamePort = await findAvailablePort();
  }

  const origin = secure ? `https://localhost:${gamePort}` : `http://localhost:${gamePort}`;
  const backendProxyUrl = `http://127.0.0.1:${serverPort}`;
  const secureState = secure
    ? loadSecureDevState({
        cwd: rootDir,
        mode: SECURE_MODE_LOCAL,
        env: process.env,
        gamePort,
      })
    : null;

  await reserveWorkspaceResources({
    rootDir,
    ports: [serverPort, gamePort],
    clearPlatformCache: false,
  });

  ensureWorkspacePackageBuild({
    rootDir,
    packageDir: "packages/sdk",
    label: "@air-jam/sdk",
    buildArgs: ["--filter", "@air-jam/sdk", "build"],
  });

  processGroup.run(
    "server",
    "pnpm",
    ["--filter", "@air-jam/server", "dev"],
    {
      suppressStructuredServerLogs: true,
      env: {
        PORT: String(serverPort),
      },
    },
  );
  const gameEnv = secure
    ? {
        ...buildSecureGameEnv({
          secureState,
          webOnly: true,
          env: {
            ...process.env,
            VITE_AIR_JAM_SERVER_URL: backendProxyUrl,
          },
        }),
        AIR_JAM_DEV_PROXY_BACKEND_URL: backendProxyUrl,
        VITE_AIR_JAM_SERVER_URL: backendProxyUrl,
      }
    : {
        VITE_AIR_JAM_RUNTIME_TOPOLOGY: serializeResolvedTopology(
          buildStandaloneGameTopology({
            surfaceRole: "host",
            publicHost: origin,
          }),
        ),
        VITE_AIR_JAM_PUBLIC_HOST: origin,
        AIR_JAM_DEV_PROXY_BACKEND_URL: backendProxyUrl,
        VITE_AIR_JAM_SERVER_URL: backendProxyUrl,
      };
  processGroup.run(
    activeGame.id,
    "pnpm",
    ["exec", "vite"],
    {
      cwd: activeGame.dir,
      env: {
        VITE_PORT: String(gamePort),
        ...gameEnv,
        ...(secureState
          ? {
              AIR_JAM_SECURE_ROOT: rootDir,
            }
          : {}),
      },
    },
  );

  await waitForUrl(`${backendProxyUrl}/health`, "Air Jam server");
  await waitForUrl(origin, `${activeGame.id} standalone host`);
  await waitForUrl(`${origin}/controller`, `${activeGame.id} standalone controller`);

  return {
    activeGame,
    processGroup,
    urls: {
      appOrigin: origin,
      hostUrl: origin,
      controllerBaseUrl: `${origin}/controller`,
      publicHost: origin,
      localBuildUrl: null,
      browserBuildUrl: null,
    },
    shutdown: () => processGroup.shutdown(0),
  };
};
