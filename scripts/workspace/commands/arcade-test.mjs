import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  detectLocalIpv4,
  loadEnvFile,
} from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  SECURE_MODE_LOCAL,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";
import {
  defaultWorkspaceGameId,
  findRepoGame,
  toLocalReferenceUrlEnvKey,
} from "../lib/repo-games.mjs";
import {
  createWorkspaceProcessGroup,
  reserveWorkspaceResources,
} from "../lib/workspace-stack.mjs";

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
      "Tunnel secure mode is not supported for local Arcade integration. Use `pnpm arcade:test -- --game=<id> --secure` for local HTTPS, or direct game dev for tunnel workflows.",
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
        gamePort: DEFAULT_PLATFORM_PORT,
      })
    : null;
  const lanIp = detectLocalIpv4();
  const platformUrl = secure
    ? secureState.platformHost
    : `http://${lanIp ?? "127.0.0.1"}:${DEFAULT_PLATFORM_PORT}`;
  const localBuildUrl = `${platformUrl}/airjam-local-builds/${activeGame.id}`;
  const platformEnv = {
    AIR_JAM_DEV_PROXY_BACKEND_URL: "http://127.0.0.1:4000",
    AIR_JAM_LOCAL_BUILD_ACTIVE_GAME_ID: activeGame.id,
    AIR_JAM_LOCAL_BUILD_ACTIVE_DIST_DIR: path.join(activeGame.dir, "dist"),
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: platformUrl,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: activeGame.id,
    NEXT_PUBLIC_APP_URL: platformUrl,
    BETTER_AUTH_URL: platformUrl,
    [toLocalReferenceUrlEnvKey(activeGame.id)]: localBuildUrl,
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
      },
    );
  }
};
