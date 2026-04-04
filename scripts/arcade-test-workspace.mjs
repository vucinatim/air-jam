#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { detectLocalIpv4, loadEnvFile } from "../packages/create-airjam/runtime/dev-utils.mjs";
import {
  DEFAULT_PLATFORM_PORT,
  loadSecureDevState,
  resolveRequestedSecureMode,
  SECURE_MODE_LOCAL,
} from "../packages/create-airjam/runtime/secure-dev.mjs";
import { defaultWorkspaceGameId, findRepoGame, loadRepoGames, toLocalReferenceUrlEnvKey } from "./lib/repo-games.mjs";
import {
  createWorkspaceProcessGroup,
  reserveWorkspaceResources,
} from "./lib/workspace-stack.mjs";

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
const selectedGame = getFlagValue("--game") ?? defaultWorkspaceGameId;
const secure = hasFlag("--secure");
const secureMode = resolveRequestedSecureMode({
  argv: args,
  env: process.env,
});
const activeGame = findRepoGame(selectedGame);

const usage = () => {
  console.log("Usage: pnpm arcade:test [--game=<id>] [--secure]");
  console.log("");
  console.log("Modes:");
  console.log(
    "  default      Build the selected game once and validate it inside local Arcade",
  );
  console.log("  --secure     Run the local Arcade integration stack over trusted HTTPS");
  console.log("");
  console.log("Notes:");
  console.log("  - This is the stable integration flow for host/controller/QR testing.");
  console.log("  - Fast live development stays on `pnpm dev -- --game=<id>`.");
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

if (!activeGame) {
  console.error(`[arcade:test] Unknown game "${selectedGame}".`);
  console.error("");
  usage();
  process.exit(1);
}

if (secure && secureMode !== SECURE_MODE_LOCAL) {
  console.error(
    "[arcade:test] Tunnel secure mode is not supported for local Arcade integration.",
  );
  console.error(
    "[arcade:test] Use `pnpm arcade:test -- --game=<id> --secure` for local HTTPS, or direct game dev for tunnel workflows.",
  );
  process.exit(1);
}

const rootDir = process.cwd();
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
