#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWorkspaceDevLogSink } from "./lib/workspace-dev-log-sink.mjs";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const hasFlag = (flag) => args.includes(flag);

const selectedGame = hasFlag("--pong") ? "pong" : "air-capture";

const usage = () => {
  console.log("Usage: pnpm dev [--pong]");
  console.log("");
  console.log("Modes:");
  console.log("  default   Start sdk, server, platform, and air-capture");
  console.log("  --pong    Start sdk, server, platform, and the pong template");
};

if (hasFlag("--help") || hasFlag("-h")) {
  usage();
  process.exit(0);
}

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

const processes =
  selectedGame === "pong"
    ? [
        ["sdk", ["pnpm", "--filter", "@air-jam/sdk", "dev"]],
        ["server", ["pnpm", "--filter", "@air-jam/server", "dev"]],
        ["platform", ["pnpm", "--filter", "platform", "dev"]],
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
        ["platform", ["pnpm", "--filter", "platform", "dev"]],
        [
          "air-capture",
          ["pnpm", "--filter", "air-capture", "dev", "--", "--host"],
        ],
      ];

console.log(
  `[dev] Starting workspace stack with ${selectedGame} as the active reference game.`,
);

for (const [name, command] of processes) {
  processGroup.run(name, command[0], command.slice(1));
}
