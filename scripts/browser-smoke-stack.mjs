#!/usr/bin/env node

import { spawn } from "node:child_process";
import net from "node:net";

const repoRoot = process.cwd();
const STACK_PORTS = [3000, 4000, 5173];

const baseEnv = {
  ...process.env,
  CI: process.env.CI ?? "1",
  NO_UPDATE_NOTIFIER: "1",
};

const processes = [];
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

  startProcess("sdk", ["pnpm", "--filter", "@air-jam/sdk", "dev"]);
  startProcess("server", ["pnpm", "--filter", "@air-jam/server", "dev"], {
    PORT: "4000",
  });
  await waitForUrl("http://127.0.0.1:4000/health", "Air Jam server");

  startProcess(
    "pong",
    ["pnpm", "--filter", "my-airjam-game", "dev", "--", "--web-only"],
    {
      VITE_AIR_JAM_PUBLIC_HOST: "http://127.0.0.1:5173",
      VITE_AIR_JAM_SERVER_URL: "http://127.0.0.1:4000",
    },
  );
  await waitForUrl("http://127.0.0.1:5173", "Pong template");

  startProcess("platform", ["pnpm", "--filter", "platform", "dev:no-db"], {
    NEXT_PUBLIC_AIR_JAM_SERVER_URL: "http://127.0.0.1:4000",
    NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "http://127.0.0.1:3000",
    NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL: "http://127.0.0.1:5173",
  });
  await waitForUrl(
    "http://127.0.0.1:3000/arcade/local-pong",
    "platform local arcade fixture",
    60_000,
  );

  console.log("[browser-smoke] Local browser smoke stack is ready.");
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error.message || error);
  shutdown(1);
});
