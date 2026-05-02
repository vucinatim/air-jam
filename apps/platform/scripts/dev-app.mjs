#!/usr/bin/env node

import { spawn } from "node:child_process";
import { appendNextHttpsArgs } from "../../../packages/create-airjam/runtime/secure-dev.mjs";

const args = appendNextHttpsArgs({
  env: process.env,
  args: ["dev", ...process.argv.slice(2)],
});

const child = spawn("next", args, {
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
