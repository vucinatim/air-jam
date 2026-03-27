#!/usr/bin/env node

import { spawn } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const hasFlag = (flag) => args.includes(flag);

const selectedGame = hasFlag("--pong") ? "pong" : "prototype-game";

const usage = () => {
  console.log("Usage: pnpm dev [--pong]");
  console.log("");
  console.log("Modes:");
  console.log("  default   Start sdk, server, platform, and prototype-game");
  console.log("  --pong    Start sdk, server, platform, and the pong template");
};

if (hasFlag("--help") || hasFlag("-h")) {
  usage();
  process.exit(0);
}

const createProcessGroup = () => {
  const children = [];
  let isShuttingDown = false;

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
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    child.stdout.on("data", (data) => log(name, data));
    child.stderr.on("data", (data) => log(name, data));
    child.on("exit", (code, signal) => {
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
          ["pnpm", "--filter", "my-airjam-game", "dev", "--", "--web-only"],
        ],
      ]
    : [
        ["sdk", ["pnpm", "--filter", "@air-jam/sdk", "dev"]],
        ["server", ["pnpm", "--filter", "@air-jam/server", "dev"]],
        ["platform", ["pnpm", "--filter", "platform", "dev"]],
        [
          "prototype-game",
          ["pnpm", "--filter", "prototype-game", "dev", "--", "--host"],
        ],
      ];

console.log(
  `[dev] Starting workspace stack with ${selectedGame} as the active reference game.`,
);

for (const [name, command] of processes) {
  processGroup.run(name, command[0], command.slice(1));
}
