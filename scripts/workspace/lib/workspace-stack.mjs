import { execFileSync, spawn } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createWorkspaceDevLogSink } from "./workspace-dev-log-sink.mjs";

const readPidList = (command, args, cwd) => {
  try {
    const output = execFileSync(command, args, {
      cwd,
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

const readListeningPids = (cwd, port) =>
  readPidList("lsof", ["-nP", `-tiTCP:${port}`, "-sTCP:LISTEN"], cwd);

const clearPortListeners = async (cwd, ports) => {
  const pidToPorts = new Map();

  for (const port of ports) {
    for (const pid of readListeningPids(cwd, port)) {
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
      for (const pid of readListeningPids(cwd, port)) {
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

const clearPlatformDevArtifacts = (rootDir) => {
  const platformDevCachePath = path.join(rootDir, "apps/platform/.next/dev");
  const platformDevLockPath = path.join(platformDevCachePath, "lock");
  const lockOwners = readPidList("lsof", ["-t", platformDevLockPath], rootDir);
  let killedAny = false;

  for (const pid of lockOwners) {
    killedAny = killProcess(pid, "platform dev lock") || killedAny;
  }

  if (existsSync(platformDevCachePath)) {
    try {
      rmSync(platformDevCachePath, { force: true, recursive: true });
      console.log("[dev] Cleared platform Next dev cache.");
    } catch {
      // Best effort only.
    }
  }

  return killedAny;
};

export const reserveWorkspaceResources = async ({
  rootDir,
  ports,
  clearPlatformCache = true,
}) => {
  const killedPorts = await clearPortListeners(rootDir, ports);
  const killedLockOwners = clearPlatformCache
    ? clearPlatformDevArtifacts(rootDir)
    : false;

  if (killedPorts || killedLockOwners) {
    await delay(400);
  }
};

export const createWorkspaceProcessGroup = ({ rootDir = process.cwd() } = {}) => {
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

  const run = (name, command, commandArgs, options = {}) => {
    const commandText = [command, ...commandArgs].join(" ");
    const childCwd = options.cwd ?? rootDir;
    const suppressStructuredServerLogs =
      options.suppressStructuredServerLogs === true;
    const child = spawn(command, commandArgs, {
      cwd: childCwd,
      env: {
        ...process.env,
        ...(options.env ?? {}),
      },
      stdio: ["inherit", "pipe", "pipe"],
    });

    logSink.recordStart({
      processName: name,
      tool: command,
      command: commandText,
      cwd: childCwd,
      pid: child.pid ?? null,
    });

    child.stdout.on("data", (data) => {
      log(name, data);
      logSink.captureChunk({
        processName: name,
        stream: "stdout",
        chunk: data,
        tool: command,
        command: commandText,
        cwd: childCwd,
        suppressStructuredServerLogs,
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
        cwd: childCwd,
        suppressStructuredServerLogs,
      });
    });
    child.on("exit", (code, signal) => {
      logSink.flush({
        processName: name,
        tool: command,
        command: commandText,
        cwd: childCwd,
      });
      logSink.recordExit({
        processName: name,
        tool: command,
        command: commandText,
        cwd: childCwd,
        pid: child.pid ?? null,
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

  return {
    run,
    shutdown,
  };
};
