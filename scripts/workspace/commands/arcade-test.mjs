import { execFileSync } from "node:child_process";
import path from "node:path";
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

export const runWorkspaceArcadeTestCommand = async ({
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
      "Tunnel secure mode is not supported for local Arcade integration. Use `pnpm arcade:test --game=<id> --secure` for local HTTPS, or direct game dev for tunnel workflows.",
    );
  }

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const runCommand = (label, command, commandArgs, cwd = rootDir) => {
    console.log(`[arcade:test] ${label}`);
    execFileSync(command, commandArgs, {
      cwd,
      stdio: "inherit",
    });
  };

  runCommand("Building @air-jam/sdk...", "pnpm", [
    "--filter",
    "@air-jam/sdk",
    "build",
  ]);
  runCommand(`Building ${activeGame.id}...`, "pnpm", [
    "--dir",
    activeGame.dir,
    "build",
  ]);

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
    gamePort: DEFAULT_GAME_PORT,
    platformPort: DEFAULT_PLATFORM_PORT,
  });
  const localBuildHostUrl = `${arcadeOrigins.hostPlatformOrigin}/airjam-local-builds/${activeGame.id}`;
  const platformHostTopology = buildPlatformShellTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "platform-host",
    appOrigin: arcadeOrigins.hostPlatformOrigin,
    publicHost: arcadeOrigins.publicPlatformOrigin,
    secureTransport: secure,
  });
  const platformControllerTopology = buildPlatformShellTopology({
    runtimeMode: "arcade-built",
    surfaceRole: "platform-controller",
    appOrigin: arcadeOrigins.publicPlatformOrigin,
    publicHost: arcadeOrigins.publicPlatformOrigin,
    secureTransport: secure,
  });
  const platformEnv = {
    AIR_JAM_DEV_PROXY_BACKEND_URL: "http://127.0.0.1:4000",
    AIR_JAM_LOCAL_BUILD_ACTIVE_GAME_ID: activeGame.id,
    AIR_JAM_LOCAL_BUILD_ACTIVE_DIST_DIR: path.join(activeGame.dir, "dist"),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY:
      serializeResolvedTopology(platformHostTopology),
    NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY:
      serializeResolvedTopology(platformControllerTopology),
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: arcadeOrigins.publicPlatformOrigin,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: activeGame.id,
    NEXT_PUBLIC_APP_URL: arcadeOrigins.publicPlatformOrigin,
    BETTER_AUTH_URL: arcadeOrigins.publicPlatformOrigin,
    [toLocalReferenceUrlEnvKey(activeGame.id)]: localBuildHostUrl,
    ...(secureState
      ? {
          AIR_JAM_SECURE_MODE: secureState.mode,
          AIR_JAM_DEV_CERT_FILE: secureState.certFile,
          AIR_JAM_DEV_KEY_FILE: secureState.keyFile,
        }
      : {}),
  };

  console.log(
    `[arcade:test] Starting stable Arcade integration stack for ${activeGame.id}${secure ? " in secure local mode" : ""}.`,
  );

  await reserveWorkspaceResources({
    rootDir,
    ports: [4000, DEFAULT_PLATFORM_PORT],
  });

  const processGroup = createWorkspaceProcessGroup({ rootDir });
  const processes = [
    {
      name: "server",
      command: ["pnpm", "--filter", "@air-jam/server", "dev"],
      suppressStructuredServerLogs: true,
    },
    {
      name: "platform",
      command: ["pnpm", "--filter", "platform", "dev:no-db"],
      env: platformEnv,
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
