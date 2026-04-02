#!/usr/bin/env node

import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const repoRoot = process.cwd();
const platformDistDir = ".next-smoke";

const readPort = (name, fallback) => {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}="${raw}". Expected a positive integer port.`);
  }

  return parsed;
};

const platformPort = readPort("AIRJAM_SMOKE_PLATFORM_PORT", 3000);
const serverPort = readPort("AIRJAM_SMOKE_SERVER_PORT", 4000);
const pongPort = readPort("AIRJAM_SMOKE_PONG_PORT", 5173);
const airCapturePort = readPort("AIRJAM_SMOKE_AIR_CAPTURE_PORT", 5174);
const STACK_PORTS = [platformPort, serverPort, pongPort, airCapturePort];

const platformBaseUrl = `http://127.0.0.1:${platformPort}`;
const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
const pongBaseUrl = `http://127.0.0.1:${pongPort}`;
const airCaptureBaseUrl = `http://127.0.0.1:${airCapturePort}`;

const baseEnv = {
  ...process.env,
  CI: process.env.CI ?? "1",
  NO_UPDATE_NOTIFIER: "1",
};

const processes = [];
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runCommand = (name, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), {
      cwd: repoRoot,
      env: {
        ...baseEnv,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => logChunk(name, chunk));
    child.stderr.on("data", (chunk) => logChunk(name, chunk));
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`[${name}] exited with code ${code ?? "null"}`));
    });
  });

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });

const assertPortsFree = async () => {
  for (const port of STACK_PORTS) {
    if (await isPortOpen(port)) {
      throw new Error(
        `Browser smoke requires port ${port} to be free. Stop the existing process and retry.`,
      );
    }
  }
};

const waitForUrl = async (url, label, timeoutMs = 45_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore transient boot failures.
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${label} at ${url}`);
};

const logChunk = (name, chunk) => {
  const text = chunk.toString();
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    console.log(`[${name}] ${line}`);
  }
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }

  setTimeout(() => {
    process.exit(code);
  }, 150);
};

const startProcess = (name, args, env = {}) => {
  const child = spawn(args[0], args.slice(1), {
    cwd: repoRoot,
    env: {
      ...baseEnv,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => logChunk(name, chunk));
  child.stderr.on("data", (chunk) => logChunk(name, chunk));
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0 || signal === "SIGTERM") {
      shutdown(0);
      return;
    }

    console.error(`[${name}] exited with code ${code ?? "null"}`);
    shutdown(code ?? 1);
  });

  processes.push(child);
  return child;
};

const main = async () => {
  await assertPortsFree();
  rmSync(path.join(repoRoot, "apps/platform", platformDistDir), {
    force: true,
    recursive: true,
  });

  await runCommand("sdk:build", ["pnpm", "--filter", "@air-jam/sdk", "build"]);
  startProcess("sdk", ["pnpm", "--filter", "@air-jam/sdk", "dev"]);
  startProcess("server", ["pnpm", "--filter", "@air-jam/server", "dev"], {
    PORT: String(serverPort),
  });
  await waitForUrl(`${serverBaseUrl}/health`, "Air Jam server");

  startProcess(
    "air-capture",
    ["pnpm", "--filter", "air-capture", "dev", "--host", "--port", String(airCapturePort)],
    {
      VITE_AIR_JAM_PUBLIC_HOST: airCaptureBaseUrl,
      VITE_AIR_JAM_SERVER_URL: serverBaseUrl,
    },
  );
  await waitForUrl(airCaptureBaseUrl, "Air Capture", 90_000);

  startProcess(
    "pong",
    [
      "pnpm",
      "--dir",
      "packages/create-airjam/templates/pong",
      "exec",
      "vite",
      "--host",
      "--port",
      String(pongPort),
    ],
    {
      VITE_AIR_JAM_PUBLIC_HOST: pongBaseUrl,
      VITE_AIR_JAM_SERVER_URL: serverBaseUrl,
    },
  );
  await waitForUrl(pongBaseUrl, "Pong template");

  startProcess("platform", ["pnpm", "--filter", "platform", "dev:no-db"], {
    PORT: String(platformPort),
    NEXT_DIST_DIR: platformDistDir,
    NEXT_PUBLIC_AIR_JAM_SERVER_URL: serverBaseUrl,
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: platformBaseUrl,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL: airCaptureBaseUrl,
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL: pongBaseUrl,
  });
  await waitForUrl(
    platformBaseUrl,
    "platform root",
    120_000,
  );

  console.log("[browser-smoke] Local browser smoke stack is ready.");
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error.message || error);
  shutdown(1);
});
