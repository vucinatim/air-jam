#!/usr/bin/env node

import {
  createProcessGroup,
  detectLocalIpv4,
  isPortOpen,
  loadEnvFile,
  waitForPort,
} from "./dev-utils.mjs";

const SERVER_PORT = 4000;
const GAME_PORT = Number(process.env.VITE_PORT || 5173);
const START_TIMEOUT_MS = 20_000;

const processGroup = createProcessGroup();
processGroup.registerSignalHandlers();

const hasFlag = (flag) => process.argv.slice(2).includes(flag);

const holdProcessOpen = async () => {
  await new Promise(() => {
    setInterval(() => {}, 1 << 30);
  });
};

const usage = () => {
  console.log("Usage: pnpm dev [--secure] [--web-only] [--allow-existing-game]");
  console.log("");
  console.log("Modes:");
  console.log("  default               Start local server + game (recommended)");
  console.log("  --secure              Start local server + game + Cloudflare tunnel");
  console.log("  --web-only            Start only Vite game app (no local server)");
  console.log(
    "  --allow-existing-game Reuse an already-running Vite server on the game port",
  );
};

const getDefaultPublicHost = () => {
  const explicitPublicHost = process.env.VITE_AIR_JAM_PUBLIC_HOST;
  if (explicitPublicHost) return explicitPublicHost;

  const detectedIp = detectLocalIpv4();
  if (!detectedIp) {
    console.warn(
      "[dev] Could not detect LAN IP. Falling back to localhost in QR links.",
    );
    console.warn("[dev] Set VITE_AIR_JAM_PUBLIC_HOST manually for phone testing.");
    return `http://localhost:${GAME_PORT}`;
  }

  return `http://${detectedIp}:${GAME_PORT}`;
};

const startServerIfNeeded = async () => {
  const hasExistingServer = await isPortOpen(SERVER_PORT);
  if (hasExistingServer) {
    console.log(`[dev] Reusing existing server on :${SERVER_PORT}`);
    return false;
  }

  processGroup.run("server", "pnpm", ["exec", "air-jam-server"]);
  await waitForPort(SERVER_PORT, START_TIMEOUT_MS);
  return true;
};

const startGame = async (env, { allowExistingGame = false } = {}) => {
  const hasExistingGame = await isPortOpen(GAME_PORT);
  if (hasExistingGame) {
    if (allowExistingGame) {
      console.log(`[dev] Reusing existing game on :${GAME_PORT}`);
      return false;
    }

    throw new Error(
      `Port ${GAME_PORT} is already in use. Stop the existing Vite dev server and retry.`,
    );
  }

  processGroup.run("game", "pnpm", ["exec", "vite"], {
    env: {
      ...process.env,
      ...env,
    },
  });
  return true;
};

const runDefaultDev = async ({ webOnly, allowExistingGame }) => {
  const publicHost = getDefaultPublicHost();
  console.log(`[dev] Using public host: ${publicHost}`);

  let startedServer = false;
  if (!webOnly) {
    startedServer = await startServerIfNeeded();
  } else {
    console.log("[dev] Web-only mode: skipping local Air Jam server startup.");
  }

  const startedGame = await startGame(
    {
      VITE_AIR_JAM_PUBLIC_HOST: publicHost,
      VITE_AIR_JAM_SERVER_URL: webOnly
        ? process.env.VITE_AIR_JAM_SERVER_URL ?? ""
        : "",
    },
    { allowExistingGame },
  );

  return startedServer || startedGame;
};

const runSecureDev = async ({ allowExistingGame }) => {
  const publicHost =
    process.env.AIR_JAM_SECURE_PUBLIC_HOST || process.env.VITE_AIR_JAM_PUBLIC_HOST;
  const tunnelName = process.env.CLOUDFLARE_TUNNEL_NAME;

  if (!publicHost || !tunnelName) {
    throw new Error(
      "Missing AIR_JAM_SECURE_PUBLIC_HOST (or VITE_AIR_JAM_PUBLIC_HOST) or CLOUDFLARE_TUNNEL_NAME. Run `pnpm run secure:init` first.",
    );
  }

  const startedServer = await startServerIfNeeded();

  const startedGame = await startGame(
    {
      VITE_AIR_JAM_PUBLIC_HOST: publicHost,
      VITE_AIR_JAM_SERVER_URL: publicHost,
    },
    { allowExistingGame },
  );
  await waitForPort(GAME_PORT, START_TIMEOUT_MS);

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

  return startedServer || startedGame || true;
};

const main = async () => {
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const secure = hasFlag("--secure");
  const webOnly = hasFlag("--web-only");
  const allowExistingGame = hasFlag("--allow-existing-game");
  const help = hasFlag("--help") || hasFlag("-h");

  if (help) {
    usage();
    return;
  }

  if (secure && webOnly) {
    throw new Error("Cannot combine --secure and --web-only.");
  }

  if (secure) {
    await runSecureDev({ allowExistingGame });
    return;
  }

  const startedManagedProcess = await runDefaultDev({
    webOnly,
    allowExistingGame,
  });

  if (!startedManagedProcess) {
    await holdProcessOpen();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  processGroup.shutdown(1);
});
