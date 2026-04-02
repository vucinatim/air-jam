#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  createProcessGroup,
  detectLocalIpv4,
  isPortOpen,
  loadEnvFile,
  waitForPort,
} from "./dev-utils.mjs";

const SERVER_PORT = 4000;
const START_TIMEOUT_MS = 20_000;

const processGroup = createProcessGroup();
processGroup.registerSignalHandlers();

const cliArgs = process.argv.slice(2);
const hasFlag = (flag) => cliArgs.includes(flag);
const getFlagValue = (flag) => {
  const index = cliArgs.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return cliArgs[index + 1] ?? null;
};

const getGamePort = () => {
  const cliPort = getFlagValue("--port");
  const rawPort = cliPort ?? process.env.VITE_PORT ?? "5173";
  const parsedPort = Number(rawPort);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error(`Invalid port: ${rawPort}`);
  }

  return parsedPort;
};

const usage = () => {
  console.log("Usage: pnpm dev [--secure] [--web-only] [--server-only] [--port 5317]");
  console.log("");
  console.log("Modes:");
  console.log("  default       Start local server + game (recommended)");
  console.log("  --secure      Start local server + game + Cloudflare tunnel");
  console.log("  --web-only    Start only Vite game app (no local server)");
  console.log("  --server-only Start only the local Air Jam server");
  console.log("  --port        Override the Vite port for local Arcade testing");
};

const resolveWorkspaceRoot = () => {
  const explicitRoot = process.env.AIR_JAM_WORKSPACE_DIR;
  if (explicitRoot) {
    return explicitRoot;
  }

  return path.resolve(process.cwd(), "../../../MyProjects/air-jam");
};

const resolveServerCommand = () => {
  const localBin = path.resolve(process.cwd(), "node_modules/.bin/air-jam-server");
  if (fs.existsSync(localBin)) {
    return {
      command: localBin,
      args: [],
    };
  }

  const workspaceRoot = resolveWorkspaceRoot();
  if (fs.existsSync(path.join(workspaceRoot, "package.json"))) {
    return {
      command: "pnpm",
      args: ["--dir", workspaceRoot, "exec", "air-jam-server"],
    };
  }

  throw new Error(
    "Could not resolve air-jam-server. Install @air-jam/server locally or set AIR_JAM_WORKSPACE_DIR to an Air Jam workspace checkout.",
  );
};

const getDefaultPublicHost = () => {
  const gamePort = getGamePort();
  const explicitPublicHost = process.env.VITE_AIR_JAM_PUBLIC_HOST;
  if (explicitPublicHost) return explicitPublicHost;

  const detectedIp = detectLocalIpv4();
  if (!detectedIp) {
    console.warn(
      "[dev] Could not detect LAN IP. Falling back to localhost in QR links.",
    );
    console.warn("[dev] Set VITE_AIR_JAM_PUBLIC_HOST manually for phone testing.");
    return `http://localhost:${gamePort}`;
  }

  return `http://${detectedIp}:${gamePort}`;
};

const startServerIfNeeded = async () => {
  const hasExistingServer = await isPortOpen(SERVER_PORT);
  if (hasExistingServer) {
    console.log(`[dev] Reusing existing server on :${SERVER_PORT}`);
    return;
  }

  const serverCommand = resolveServerCommand();
  processGroup.run("server", serverCommand.command, serverCommand.args);
  await waitForPort(SERVER_PORT, START_TIMEOUT_MS);
};

const startGame = async (env) => {
  const gamePort = getGamePort();
  const hasExistingGame = await isPortOpen(gamePort);
  if (hasExistingGame) {
    throw new Error(
      `Port ${gamePort} is already in use. Stop the existing Vite dev server and retry.`,
    );
  }

  processGroup.run("game", "pnpm", ["exec", "vite"], {
    env: {
      ...process.env,
      VITE_PORT: String(gamePort),
      ...env,
    },
  });
};

const runDefaultDev = async ({ webOnly }) => {
  const publicHost = getDefaultPublicHost();
  console.log(`[dev] Using public host: ${publicHost}`);

  if (!webOnly) {
    await startServerIfNeeded();
  } else {
    console.log("[dev] Web-only mode: skipping local Air Jam server startup.");
  }

  await startGame({
    VITE_AIR_JAM_PUBLIC_HOST: publicHost,
  });
};

const runSecureDev = async () => {
  const publicHost =
    process.env.AIR_JAM_SECURE_PUBLIC_HOST || process.env.VITE_AIR_JAM_PUBLIC_HOST;
  const tunnelName = process.env.CLOUDFLARE_TUNNEL_NAME;

  if (!publicHost || !tunnelName) {
    throw new Error(
      "Missing AIR_JAM_SECURE_PUBLIC_HOST (or VITE_AIR_JAM_PUBLIC_HOST) or CLOUDFLARE_TUNNEL_NAME. Run `pnpm run secure:init` first.",
    );
  }

  await startServerIfNeeded();

  await startGame({
    VITE_AIR_JAM_PUBLIC_HOST: publicHost,
    VITE_AIR_JAM_SERVER_URL: publicHost,
  });
  await waitForPort(getGamePort(), START_TIMEOUT_MS);

  processGroup.run("cloudflared", "pnpm", [
    "exec",
    "cloudflared",
    "tunnel",
    "--config",
    ".cloudflared/config.yml",
    "run",
    tunnelName,
  ]);

  console.log("\nAir Jam secure dev is running.");
  console.log(`Open host: ${publicHost}`);
  console.log(`Cloudflare tunnel: ${tunnelName}`);
  console.log("Local server remains on http://localhost:4000 via Vite proxy.");
  console.log("QR codes use the secure host above.");
};

const main = async () => {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const secure = hasFlag("--secure");
  const serverOnly = hasFlag("--server-only");
  const webOnly = hasFlag("--web-only");
  const help = hasFlag("--help") || hasFlag("-h");

  if (help) {
    usage();
    return;
  }

  if ((secure && webOnly) || (secure && serverOnly) || (webOnly && serverOnly)) {
    throw new Error(
      "Choose exactly one optional mode: --secure, --web-only, or --server-only.",
    );
  }

  if (serverOnly) {
    await startServerIfNeeded();
    return;
  }

  if (secure) {
    await runSecureDev();
    return;
  }

  await runDefaultDev({ webOnly });
};

main().catch((error) => {
  console.error(error.message || error);
  processGroup.shutdown(1);
});
