#!/usr/bin/env node

import { spawn } from "node:child_process";

const passthroughArgs = process.argv.slice(2);

if (passthroughArgs.includes("--help") || passthroughArgs.includes("-h")) {
  console.log(`Usage: pnpm --filter platform dev [-- <next-dev-flags>]

Starts the platform app and Drizzle Studio together.

Use:
  pnpm --filter platform dev:no-db -- --help
for direct Next dev flags without the DB companion process.`);
  process.exit(0);
}

const children = [];
let shuttingDown = false;

const stopChildren = (signal = "SIGTERM") => {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

const shutdown = (code = 0) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopChildren();
  setTimeout(() => process.exit(code), 100);
};

const run = (name, args) => {
  const child = spawn("pnpm", args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  children.push(child);
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code === 0 || signal === "SIGTERM") {
      shutdown(0);
      return;
    }

    console.error(`[platform:${name}] exited with code ${code ?? "unknown"}`);
    shutdown(code ?? 1);
  });
};

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("db", ["run", "dev:db"]);
run("app", ["run", "dev:app", "--", ...passthroughArgs]);
