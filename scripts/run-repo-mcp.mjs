#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const buildResult = spawnSync(
  "pnpm",
  ["--filter", "@air-jam/mcp-server", "build"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
);

if (buildResult.stdout) {
  process.stderr.write(buildResult.stdout);
}
if (buildResult.stderr) {
  process.stderr.write(buildResult.stderr);
}
if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const child = spawn(
  process.execPath,
  [
    path.join(repoRoot, "packages/mcp-server/dist/cli.js"),
    ...process.argv.slice(2),
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
