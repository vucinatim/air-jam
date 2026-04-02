#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createWorkspaceDevLogSink } from "./lib/workspace-dev-log-sink.mjs";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const hasFlag = (flag) => args.includes(flag);

const selectedGame = hasFlag("--pong") ? "pong" : "air-capture";
const startDbStudio = hasFlag("--db-studio");

const usage = () => {
  console.log("Usage: pnpm dev [--pong] [--db-studio]");
  console.log("");
  console.log("Modes:");
  console.log("  default      Start sdk watch, server, platform app, and air-capture");
  console.log("  --pong       Start sdk watch, server, platform app, and the pong template");
  console.log("  --db-studio  Also start Drizzle Studio for the platform database");
};

if (hasFlag("--help") || hasFlag("-h")) {
  usage();
  process.exit(0);
}

const rootDir = process.cwd();
const platformDevCachePath = path.join(rootDir, "apps/platform/.next/dev");
const platformDevLockPath = path.join(
  rootDir,
  "apps/platform/.next/dev/lock",
);

const readPidList = (command, args) => {
  try {
    const output = execFileSync(command, args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!output) {
      return [];
    }

    return output
      .split("\n")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
};

const killProcess = (pid, reason, signal = "SIGTERM") => {
  if (pid === process.pid) {
    return false;
  }

  try {
    process.kill(pid, signal);
    console.log(
      `[dev] Stopped process ${pid} (${reason})${signal === "SIGKILL" ? " with SIGKILL" : ""}.`,
    );
    return true;
  } catch {
    return false;
  }
};

const readListeningPids = (port) =>
  readPidList("lsof", ["-nP", "-tiTCP:" + port, "-sTCP:LISTEN"]);

const clearPortListeners = async (ports) => {
  const pidToPorts = new Map();

  for (const port of ports) {
    for (const pid of readListeningPids(port)) {
      const claimedPorts = pidToPorts.get(pid) ?? [];
      claimedPorts.push(port);
      pidToPorts.set(pid, claimedPorts);
    }
  }

  if (pidToPorts.size === 0) {
    return false;
  }

  for (const [pid, claimedPorts] of pidToPorts) {
    killProcess(pid, `ports ${claimedPorts.join(", ")}`);
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(200);

    const remaining = new Map();
    for (const port of ports) {
      for (const pid of readListeningPids(port)) {
        const claimedPorts = remaining.get(pid) ?? [];
        claimedPorts.push(port);
        remaining.set(pid, claimedPorts);
      }
    }

    if (remaining.size === 0) {
      return true;
    }

    if (attempt === 9) {
      for (const [pid, claimedPorts] of remaining) {
        killProcess(pid, `ports ${claimedPorts.join(", ")}`, "SIGKILL");
      }

      await delay(200);
    }
  }

  return true;
};

const clearPlatformDevArtifacts = () => {
  const lockOwners = readPidList("lsof", ["-t", platformDevLockPath]);
  let killedAny = false;
  for (const pid of lockOwners) {
    killedAny = killProcess(pid, "platform dev lock") || killedAny;
  }

  if (existsSync(platformDevCachePath)) {
    try {
      rmSync(platformDevCachePath, { force: true, recursive: true });
      console.log("[dev] Cleared platform Next dev cache.");
    } catch {
      // Best effort only; Next will report if the cache still cannot be regenerated cleanly.
    }
  }

  return killedAny;
};

const reserveWorkspaceResources = async () => {
  const ports = [3000, 4000, 5173];
  if (startDbStudio) {
    ports.push(4983);
  }

  const killedPorts = await clearPortListeners(ports);
  const killedLockOwners = clearPlatformDevArtifacts();

  if (killedPorts || killedLockOwners) {
    await delay(400);
  }
};

const createProcessGroup = () => {
  const children = [];
  let isShuttingDown = false;
  const logSink = createWorkspaceDevLogSink();

  const shutdown = (code = 0) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    for (const child of children) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }

    setTimeout(() => process.exit(code), 100);
  };

  const log = (prefix, data) => {
    const text = data.toString();
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      console.log(`[${prefix}] ${line}`);
    }
  };

  const run = (name, command, commandArgs) => {
    const commandText = [command, ...commandArgs].join(" ");
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => {
      log(name, data);
      logSink.captureChunk({
        processName: name,
        stream: "stdout",
        chunk: data,
        tool: command,
        command: commandText,
        cwd: process.cwd(),
      });
    });
    child.stderr.on("data", (data) => {
      log(name, data);
      logSink.captureChunk({
        processName: name,
        stream: "stderr",
        chunk: data,
        tool: command,
        command: commandText,
        cwd: process.cwd(),
      });
    });
    child.on("exit", (code, signal) => {
      logSink.flush({
        processName: name,
        tool: command,
        command: commandText,
        cwd: process.cwd(),
      });
      logSink.recordExit({
        processName: name,
        tool: command,
        command: commandText,
        cwd: process.cwd(),
        code,
        signal,
      });

      if (isShuttingDown) {
        return;
      }

      if (code === 0 || signal === "SIGTERM") {
        shutdown(0);
        return;
      }

      console.error(`[${name}] exited with code ${code ?? "null"}`);
      shutdown(code ?? 1);
    });

    children.push(child);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  return { run };
};

const processGroup = createProcessGroup();
const platformCommand = startDbStudio ? "dev" : "dev:no-db";

const processes =
  selectedGame === "pong"
    ? [
        ["sdk", ["pnpm", "--filter", "@air-jam/sdk", "dev"]],
        ["server", ["pnpm", "--filter", "@air-jam/server", "dev"]],
        ["platform", ["pnpm", "--filter", "platform", platformCommand]],
        [
          "pong",
          [
            "pnpm",
            "--filter",
            "my-airjam-game",
            "dev",
            "--",
            "--web-only",
            "--allow-existing-game",
          ],
        ],
      ]
    : [
        ["sdk", ["pnpm", "--filter", "@air-jam/sdk", "dev"]],
        ["server", ["pnpm", "--filter", "@air-jam/server", "dev"]],
        ["platform", ["pnpm", "--filter", "platform", platformCommand]],
        [
          "air-capture",
          ["pnpm", "--filter", "air-capture", "dev", "--", "--host"],
        ],
      ];

console.log(
  `[dev] Starting workspace stack with ${selectedGame} as the active reference game${startDbStudio ? " and Drizzle Studio enabled" : ""}.`,
);

await reserveWorkspaceResources();

for (const [name, command] of processes) {
  processGroup.run(name, command[0], command.slice(1));
}
