import path from "node:path";
import { loadEnvFile } from "../../../packages/cli/runtime/dev-utils.mjs";
import { loadCreateAirJamRuntimeEnv } from "../../../packages/cli/runtime/runtime-env.mjs";
import { SECURE_MODE_LOCAL } from "../../../packages/cli/runtime/secure-dev.mjs";
import { defaultWorkspaceGameId, findRepoGame } from "../lib/repo-games.mjs";
import {
  assertWorkspacePortsAvailable,
  createWorkspaceProcessGroup,
} from "../lib/workspace-stack.mjs";

export const startSharedWorkspaceProcesses = async ({
  processGroup,
  activeGame,
  gameArgs,
  gameEnv,
  serverPort,
}) => {
  await processGroup.run("sdk", "pnpm", ["--filter", "@air-jam/sdk", "dev"], {
    readyMarker: "AIR_JAM_SDK_BUILD_READY",
  });
  processGroup.run("server", "pnpm", ["--filter", "@air-jam/server", "dev"], {
    suppressStructuredServerLogs: true,
    env: { PORT: String(serverPort) },
  });
  processGroup.run(
    activeGame.id,
    "pnpm",
    ["--dir", activeGame.dir, "dev", "--", ...gameArgs],
    { env: gameEnv },
  );
};

export const runWorkspaceStandaloneDevCommand = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  secure = false,
  secureMode = SECURE_MODE_LOCAL,
} = {}) => {
  const activeGame = findRepoGame({ rootDir, gameId });
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }
  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));
  const runtimeEnv = loadCreateAirJamRuntimeEnv({
    env: process.env,
    boundary: "repo.standalone-dev",
  });
  await assertWorkspacePortsAvailable({
    ports: [runtimeEnv.AIR_JAM_SERVER_PORT, runtimeEnv.VITE_PORT],
  });
  const processGroup = createWorkspaceProcessGroup({ rootDir });
  const gameArgs = ["--web-only"];
  if (secure) {
    gameArgs.push("--secure");
    if (secureMode !== SECURE_MODE_LOCAL) {
      gameArgs.push("--secure-mode", secureMode);
    }
  }
  console.log(`[standalone:dev] Starting ${activeGame.id}.`);
  await startSharedWorkspaceProcesses({
    processGroup,
    activeGame,
    gameArgs,
    serverPort: runtimeEnv.AIR_JAM_SERVER_PORT,
    gameEnv: secure ? { AIR_JAM_SECURE_ROOT: rootDir } : undefined,
  });
};
