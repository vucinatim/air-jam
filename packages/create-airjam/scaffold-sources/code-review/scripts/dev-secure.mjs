#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

const SERVER_PORT = 4000;
const GAME_PORT = 5173;
const START_TIMEOUT_MS = 20_000;

const children = [];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function logPrefix(prefix, data) {
  const text = data.toString();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    console.log(`[${prefix}] ${line}`);
  }
}

function run(name, command, args, options = {}) {
  const { fatal = true, ...spawnOptions } = options;
  const child = spawn(command, args, {
    stdio: ["inherit", "pipe", "pipe"],
    ...spawnOptions,
  });

  child.stdout.on("data", (data) => logPrefix(name, data));
  child.stderr.on("data", (data) => logPrefix(name, data));
  child.on("exit", (code) => {
    if (fatal && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code ?? 1);
    }
  });

  children.push(child);
  return child;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(400);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const tryConnect = () => {
      const socket = net.createConnection({ port, host: "127.0.0.1" });

      socket.on("connect", () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for localhost:${port}`));
          return;
        }
        setTimeout(tryConnect, 300);
      });
    };

    tryConnect();
  });
}

let isShuttingDown = false;
function shutdown(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => process.exit(code), 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  console.log("Starting Air Jam secure dev mode (Cloudflare named tunnel)...");
  loadEnvFile(".env");
  loadEnvFile(".env.local");

  const publicHost =
    process.env.AIR_JAM_SECURE_PUBLIC_HOST ||
    process.env.VITE_AIR_JAM_PUBLIC_HOST;
  const tunnelName = process.env.CLOUDFLARE_TUNNEL_NAME;
  if (!publicHost || !tunnelName) {
    throw new Error(
      "Missing AIR_JAM_SECURE_PUBLIC_HOST (or VITE_AIR_JAM_PUBLIC_HOST) or CLOUDFLARE_TUNNEL_NAME. Run `pnpm run secure:init` first.",
    );
  }

  const hasExistingServer = await isPortOpen(SERVER_PORT);
  if (hasExistingServer) {
    console.log(
      `Detected existing local server on :${SERVER_PORT}, reusing it.`,
    );
  } else {
    run("server", "pnpm", ["run", "dev:server"]);
    await waitForPort(SERVER_PORT, START_TIMEOUT_MS);
  }

  const hasExistingGame = await isPortOpen(GAME_PORT);
  if (hasExistingGame) {
    throw new Error(
      `Port ${GAME_PORT} is already in use. Stop existing Vite dev server and retry.`,
    );
  }

  run("game", "pnpm", ["run", "dev"], {
    env: {
      ...process.env,
      VITE_AIR_JAM_PUBLIC_HOST: publicHost,
      VITE_AIR_JAM_SERVER_URL: publicHost,
    },
  });
  await waitForPort(GAME_PORT, START_TIMEOUT_MS);

  run("cloudflared", "pnpm", [
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
}

main().catch((error) => {
  console.error(error.message || error);
  shutdown(1);
});
