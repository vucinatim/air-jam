import path from "node:path";
import {
  defaultWorkspaceGameId,
  findRepoGame,
  toLocalReferenceUrlEnvKey,
} from "../lib/repo-games.mjs";
import {
  createWorkspaceProcessGroup,
  reserveWorkspaceResources,
} from "../lib/workspace-stack.mjs";
import { resolveWorkspaceArcadeOrigins } from "../lib/workspace-runtime-origins.mjs";
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import {
  buildPlatformShellTopology,
  serializeResolvedTopology,
} from "../../../packages/create-airjam/runtime/runtime-topology.mjs";

const BACKEND_PROXY_URL = "http://127.0.0.1:4000";

const startSharedWorkspaceProcesses = ({
  processGroup,
  activeGame,
  includePlatform,
  startDbStudio = false,
  platformEnv,
  gameArgs,
  gameEnv,
}) => {
  const processes = [
    {
      name: "sdk",
      command: ["pnpm", "--filter", "@air-jam/sdk", "dev"],
    },
    {
      name: "server",
      command: ["pnpm", "--filter", "@air-jam/server", "dev"],
      suppressStructuredServerLogs: true,
    },
    ...(includePlatform
      ? [
          {
            name: "platform",
            command: [
              "pnpm",
              "--filter",
              "platform",
              startDbStudio ? "dev" : "dev:no-db",
            ],
            env: platformEnv,
          },
        ]
      : []),
    {
      name: activeGame.id,
      command: ["pnpm", "--dir", activeGame.dir, "dev", "--", ...gameArgs],
      env: gameEnv,
    },
  ];

  for (const processSpec of processes) {
    processGroup.run(
      processSpec.name,
      processSpec.command[0],
      processSpec.command.slice(1),
      {
        env: processSpec.env,
        suppressStructuredServerLogs: processSpec.suppressStructuredServerLogs,
      },
    );
  }
};

export const runWorkspaceStandaloneDevCommand = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  secure = false,
  secureMode = SECURE_MODE_LOCAL,
} = {}) => {
  const activeGame = findRepoGame(gameId);
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const processGroup = createWorkspaceProcessGroup({ rootDir });
  const gameArgs = ["--web-only", "--allow-existing-game"];
  const gameEnv = secure ? { AIR_JAM_SECURE_ROOT: rootDir } : undefined;

  if (secure) {
    gameArgs.push("--secure");
    if (secureMode !== SECURE_MODE_LOCAL) {
      gameArgs.push("--secure-mode", secureMode);
    }
  }

  console.log(
    `[standalone:dev] Starting live standalone workspace stack for ${activeGame.id}${secure ? " in secure local mode" : ""}.`,
  );

  await reserveWorkspaceResources({
    rootDir,
    ports: [4000, DEFAULT_GAME_PORT],
  });

  startSharedWorkspaceProcesses({
    processGroup,
    activeGame,
    includePlatform: false,
    gameArgs,
    gameEnv,
  });
};

export const runWorkspaceArcadeDevCommand = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  startDbStudio = false,
  secure = false,
} = {}) => {
  const activeGame = findRepoGame(gameId);
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const processGroup = createWorkspaceProcessGroup({ rootDir });
  const secureState = secure
    ? loadSecureDevState({
        cwd: rootDir,
        mode: SECURE_MODE_LOCAL,
        env: process.env,
        gamePort: DEFAULT_GAME_PORT,
      })
    : null;
  const arcadeOrigins = resolveWorkspaceArcadeOrigins({
    secure,
    secureState,
  });
  const platformHostTopology = buildPlatformShellTopology({
    runtimeMode: "arcade-live",
    surfaceRole: "platform-host",
    appOrigin: arcadeOrigins.hostPlatformOrigin,
    publicHost: arcadeOrigins.publicPlatformOrigin,
    secureTransport: secure,
  });
  const platformControllerTopology = buildPlatformShellTopology({
    runtimeMode: "arcade-live",
    surfaceRole: "platform-controller",
    appOrigin: arcadeOrigins.publicPlatformOrigin,
    publicHost: arcadeOrigins.publicPlatformOrigin,
    secureTransport: secure,
  });
  const platformEnv = {
    AIR_JAM_DEV_PROXY_BACKEND_URL: BACKEND_PROXY_URL,
    NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY:
      serializeResolvedTopology(platformHostTopology),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY:
      serializeResolvedTopology(platformControllerTopology),
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: arcadeOrigins.publicPlatformOrigin,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: activeGame.id,
    [toLocalReferenceUrlEnvKey(activeGame.id)]: arcadeOrigins.publicGameOrigin,
    ...(secureState
      ? {
          AIR_JAM_SECURE_MODE: secureState.mode,
          AIR_JAM_DEV_CERT_FILE: secureState.certFile,
          AIR_JAM_DEV_KEY_FILE: secureState.keyFile,
          NEXT_PUBLIC_APP_URL: arcadeOrigins.publicPlatformOrigin,
          BETTER_AUTH_URL: arcadeOrigins.publicPlatformOrigin,
        }
      : {}),
  };
  const gameArgs = ["--web-only", "--allow-existing-game"];
  const gameEnv = secure ? { AIR_JAM_SECURE_ROOT: rootDir } : undefined;

  if (secure) {
    gameArgs.push("--secure");
  }

  console.log(
    `[arcade:dev] Starting live Arcade workspace stack with ${activeGame.id} embedded through the platform${startDbStudio ? " and Drizzle Studio enabled" : ""}${secure ? " in secure local mode" : ""}.`,
  );

  await reserveWorkspaceResources({
    rootDir,
    ports: [
      4000,
      DEFAULT_PLATFORM_PORT,
      DEFAULT_GAME_PORT,
      ...(startDbStudio ? [4983] : []),
    ],
  });

  startSharedWorkspaceProcesses({
    processGroup,
    activeGame,
    includePlatform: true,
    startDbStudio,
    platformEnv,
    gameArgs,
    gameEnv,
  });
};
