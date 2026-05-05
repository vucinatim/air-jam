#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distEntry = path.join(packageRoot, "dist", "cli.js");
const sourceEntry = path.join(packageRoot, "src", "cli.ts");

const forwardToSourceCli = async () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", sourceEntry, ...process.argv.slice(2)],
      {
        cwd: packageRoot,
        stdio: "inherit",
        env: process.env,
      },
    );

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      process.exitCode = code ?? 0;
      resolve(undefined);
    });

    child.on("error", reject);
  });

if (existsSync(distEntry)) {
  await import(pathToFileURL(distEntry).href);
} else {
  await forwardToSourceCli();
}
