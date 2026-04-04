#!/usr/bin/env node

import path from "node:path";
import { defaultWorkspaceGameId, findRepoGame, loadRepoGames, toLocalReferenceUrlEnvKey } from "./lib/repo-games.mjs";
import {
  createWorkspaceProcessGroup,
  reserveWorkspaceResources,
} from "./lib/workspace-stack.mjs";
import { loadEnvFile } from "../packages/create-airjam/runtime/dev-utils.mjs";
import { DEFAULT_GAME_PORT, DEFAULT_PLATFORM_PORT } from "../packages/create-airjam/runtime/secure-dev.mjs";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const hasFlag = (flag) => args.includes(flag);
const getFlagValue = (flag) => {
  const inlineArg = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inlineArg) {
    return inlineArg.slice(flag.length + 1);
  }

  const index = args.indexOf(flag);
  return index === -1 ? null : (args[index + 1] ?? null);
};

const availableGames = loadRepoGames();
const selectedGame =
  getFlagValue("--game") ??
  (hasFlag("--pong") ? "pong" : defaultWorkspaceGameId);
const startDbStudio = hasFlag("--db-studio");
const activeGame = findRepoGame(selectedGame);

const usage = () => {
  console.log("Usage: pnpm dev [--game=<id>] [--db-studio]");
  console.log("");
  console.log("Modes:");
  console.log(
    `  default      Start sdk watch, server, platform app, and ${defaultWorkspaceGameId}`,
  );
  console.log("  --game=<id>  Start sdk watch, server, platform app, and a repo game");
  console.log("  --pong       Legacy alias for --game=pong");
  console.log("  --db-studio  Also start Drizzle Studio for the platform database");
  console.log("");
  console.log("Secure Arcade integration testing moved to:");
  console.log("  pnpm arcade:test -- --game=<id> [--secure]");
  console.log("");
  console.log("Available games:");
  for (const game of availableGames) {
    console.log(`  - ${game.id}`);
  }
};

if (hasFlag("--help") || hasFlag("-h")) {
  usage();
  process.exit(0);
}

if (hasFlag("--secure") || getFlagValue("--secure-mode")) {
  console.error(
    "[dev] Secure Arcade testing no longer runs through `pnpm dev`.",
  );
  console.error(
    `[dev] Use \`pnpm arcade:test -- --game=${selectedGame} --secure\` instead.`,
  );
  process.exit(1);
}

if (!activeGame) {
  console.error(`[dev] Unknown game "${selectedGame}".`);
  console.error("");
  usage();
  process.exit(1);
}

const rootDir = process.cwd();
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
  ports: [4000, DEFAULT_PLATFORM_PORT, DEFAULT_GAME_PORT, ...(startDbStudio ? [4983] : [])],
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
