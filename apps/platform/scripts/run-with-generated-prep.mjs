#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const repoCliPath = path.join(repoRoot, "scripts", "repo", "cli.mjs");

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error(
    "Usage: node ./scripts/run-with-generated-prep.mjs <command> [...args]",
  );
}

execFileSync("node", [repoCliPath, "platform", "generated", "prepare"], {
  cwd: repoRoot,
  stdio: "inherit",
});

const child = spawn(command, args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
