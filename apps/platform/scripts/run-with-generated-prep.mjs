#!/usr/bin/env node

import { spawn } from "node:child_process";
import { preparePlatformGeneratedArtifacts } from "../../../scripts/platform/lib/platform-generated-prepare.mjs";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error(
    "Usage: node ./scripts/run-with-generated-prep.mjs <command> [...args]",
  );
}

const result = await preparePlatformGeneratedArtifacts();

console.log(
  `✓ Platform generated artifacts are ready (${result.channel}@${result.packVersion}, ${result.fileCount} files)`,
);

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
