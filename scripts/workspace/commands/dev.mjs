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
import { loadEnvFile } from "../../../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_GAME_PORT,
  DEFAULT_PLATFORM_PORT,
} from "../../../packages/create-airjam/runtime/secure-dev.mjs";

export const runWorkspaceDevCommand = async ({
  rootDir = process.cwd(),
  gameId = defaultWorkspaceGameId,
  startDbStudio = false,
  secure = false,
  secureMode = "",
} = {}) => {
  if (secure || secureMode) {
    throw new Error(
      `Secure Arcade testing no longer runs through \`pnpm dev\`. Use \`pnpm arcade:test -- --game=${gameId} --secure\` instead.`,
    );
  }

  const activeGame = findRepoGame(gameId);
  if (!activeGame) {
    throw new Error(`Unknown game "${gameId}".`);
  }

  loadEnvFile(path.join(rootDir, ".env"));
  loadEnvFile(path.join(rootDir, ".env.local"));

  const processGroup = createWorkspaceProcessGroup({ rootDir });
  const platformCommand = startDbStudio ? "dev" : "dev:no-db";
  const localGameUrl = `http://127.0.0.1:${DEFAULT_GAME_PORT}`;
  const platformUrl = `http://127.0.0.1:${DEFAULT_PLATFORM_PORT}`;
  const platformEnv = {
    AIR_JAM_DEV_PROXY_BACKEND_URL: "http://127.0.0.1:4000",
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: platformUrl,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT: activeGame.id,
    [toLocalReferenceUrlEnvKey(activeGame.id)]: localGameUrl,
  };

  console.log(
    `[dev] Starting workspace stack with ${activeGame.id} as the active reference game${startDbStudio ? " and Drizzle Studio enabled" : ""}.`,
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

  const processes = [
    {
      name: "sdk",
      command: ["pnpm", "--filter", "@air-jam/sdk", "dev"],
    },
    {
      name: "server",
      command: ["pnpm", "--filter", "@air-jam/server", "dev"],
    },
    {
      name: "platform",
      command: ["pnpm", "--filter", "platform", platformCommand],
      env: platformEnv,
    },
    {
      name: activeGame.id,
      command: [
        "pnpm",
        "--dir",
        activeGame.dir,
        "dev",
        "--",
        "--web-only",
        "--allow-existing-game",
      ],
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
