import { execFileSync, spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createWorkspaceDevLogSink } from "./workspace-dev-log-sink.mjs";

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

const killProcessGroup = (pid, reason, signal = "SIGTERM") => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  if (process.platform === "win32") {
    return killProcess(pid, reason, signal);
  }

  try {
    process.kill(-pid, signal);
    console.log(
      `[dev] Stopped process group ${pid} (${reason})${signal === "SIGKILL" ? " with SIGKILL" : ""}.`,
    );
    return true;
  } catch {
    return killProcess(pid, reason, signal);
  }
};

export const assertWorkspacePortsAvailable = async ({ ports }) => {
  for (const port of ports) {
    for (const host of ["127.0.0.1", "0.0.0.0", "::1", "::"]) {
      await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once("error", (error) =>
          reject(
            new Error(
              `Workspace port ${port} is unavailable; inspect status and stop only the owning session before restarting.`,
              { cause: error },
            ),
          ),
        );
        server.listen({ port, host, ipv6Only: host === "::" }, () =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      });
    }
  }
};

export const findAvailablePort = async () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() =>
          reject(new Error("Could not resolve an available port.")),
        );
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const readNewestMtimeMs = (targetPath) => {
  if (!existsSync(targetPath)) {
    return 0;
  }

  const stats = statSync(targetPath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }

  let newestMtimeMs = stats.mtimeMs;
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    newestMtimeMs = Math.max(
      newestMtimeMs,
      readNewestMtimeMs(path.join(targetPath, entry.name)),
    );
  }

  return newestMtimeMs;
};

export const ensureWorkspaceBuildArtifact = ({
  rootDir,
  projectDir,
  label,
  buildArgs,
  sourcePaths,
  distCheckFile,
}) => {
  const resolvedProjectDir = path.resolve(rootDir, projectDir);
  const distCheckPath = path.join(resolvedProjectDir, distCheckFile);
  const latestSourceMtimeMs = sourcePaths.reduce(
    (latest, relativeSourcePath) =>
      Math.max(
        latest,
        readNewestMtimeMs(path.join(resolvedProjectDir, relativeSourcePath)),
      ),
    0,
  );
  const distMtimeMs = readNewestMtimeMs(distCheckPath);

  if (distMtimeMs > 0 && distMtimeMs >= latestSourceMtimeMs) {
    console.log(`[visual] Reusing cached ${label} build.`);
    return false;
  }

  console.log(`[visual] Building ${label}.`);
  execFileSync("pnpm", buildArgs, {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });
  return true;
};

export const ensureWorkspacePackageBuild = ({
  rootDir,
  packageDir,
  label,
  buildArgs,
  sourcePaths = ["src", "package.json", "tsconfig.json", "tsup.config.ts"],
  distCheckFile = "dist/index.js",
}) =>
  ensureWorkspaceBuildArtifact({
    rootDir,
    projectDir: packageDir,
    label,
    buildArgs,
    sourcePaths,
    distCheckFile,
  });

export const createWorkspaceProcessGroup = ({
  rootDir = process.cwd(),
  exitOnShutdown = true,
} = {}) => {
  const children = [];
  let isShuttingDown = false;
  let shutdownPromise = null;
  let suppressOutputAfterShutdown = false;
  const logSink = createWorkspaceDevLogSink();

  const shutdown = (code = 0) => {
    if (isShuttingDown) {
      return shutdownPromise;
    }

    isShuttingDown = true;
    suppressOutputAfterShutdown = code === 0;

    shutdownPromise = (async () => {
      for (const childEntry of children) {
        if (!childEntry.child.killed) {
          killProcessGroup(childEntry.child.pid, childEntry.name, "SIGTERM");
        }
      }

      await Promise.race([
        Promise.allSettled(
          children.map((childEntry) => childEntry.exitPromise),
        ),
        delay(2_000),
      ]);

      for (const childEntry of children) {
        if (childEntry.exited || childEntry.child.killed) {
          continue;
        }

        killProcessGroup(childEntry.child.pid, childEntry.name, "SIGKILL");
      }

      await Promise.race([
        Promise.allSettled(
          children.map((childEntry) => childEntry.exitPromise),
        ),
        delay(1_000),
      ]);

      if (exitOnShutdown) {
        process.exit(code);
      }
    })();

    return shutdownPromise;
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
      detached: process.platform !== "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });
    const childEntry = {
      child,
      name,
      exited: false,
      exitPromise: null,
    };
    childEntry.exitPromise = new Promise((resolve) => {
      const markExited = () => {
        childEntry.exited = true;
        resolve();
      };
      child.once("exit", markExited);
      child.once("error", markExited);
    });

    const ready = options.readyMarker
      ? new Promise((resolve, reject) => {
          let bufferedOutput = "";
          const cleanup = () => {
            child.stdout.off("data", onOutput);
            child.off("exit", onExit);
            child.off("error", onError);
          };
          const onOutput = (data) => {
            bufferedOutput += data.toString();
            if (bufferedOutput.includes(options.readyMarker)) {
              cleanup();
              resolve();
            } else {
              // Retain only a possible marker split across stdout chunks.
              bufferedOutput = bufferedOutput.slice(
                -(options.readyMarker.length - 1),
              );
            }
          };
          const onExit = (code, signal) => {
            cleanup();
            reject(
              new Error(
                `${name} exited before becoming ready (${signal ?? code}).`,
              ),
            );
          };
          const onError = (error) => {
            cleanup();
            reject(error);
          };
          child.stdout.on("data", onOutput);
          child.once("exit", onExit);
          child.once("error", onError);
        })
      : Promise.resolve();

    logSink.recordStart({
      processName: name,
      tool: command,
      command: commandText,
      cwd: childCwd,
      pid: child.pid ?? null,
    });

    child.stdout.on("data", (data) => {
      if (suppressOutputAfterShutdown) {
        return;
      }

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
      if (suppressOutputAfterShutdown) {
        return;
      }

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
        void shutdown(0);
        return;
      }

      console.error(`[${name}] exited with code ${code ?? "null"}`);
      void shutdown(code ?? 1);
    });
    child.on("error", (error) => {
      console.error(`[${name}] could not start: ${error.message}`);
      void shutdown(1);
    });

    children.push(childEntry);
    return ready;
  };

  process.on("SIGINT", () => {
    void shutdown(0);
  });
  process.on("SIGTERM", () => {
    void shutdown(0);
  });

  return {
    run,
    shutdown,
  };
};
