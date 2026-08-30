#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distEntry = path.join(packageRoot, "dist", "cli.js");
const repoRoot = path.resolve(packageRoot, "../..");
const workspaceBuildScript = path.join(
  repoRoot,
  "scripts",
  "ensure-workspace-package-build.mjs",
);

const buildWorkspacePackage = async () => {
  if (!existsSync(workspaceBuildScript)) {
    throw new Error(
      "The installed @air-jam/server package is missing its built CLI entrypoint.",
    );
  }

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [workspaceBuildScript, "@air-jam/server"],
      {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
      },
    );

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(
        new Error(
          signal
            ? `Workspace server build terminated by signal ${signal}.`
            : `Workspace server build exited with code ${code}.`,
        ),
      );
    });
    child.on("error", reject);
  });
};

if (!existsSync(distEntry)) {
  await buildWorkspacePackage();
}

if (!existsSync(distEntry)) {
  throw new Error(
    "The @air-jam/server build completed without producing dist/cli.js.",
  );
}

const loaded = await import(pathToFileURL(distEntry).href);
if (typeof loaded.runServerCli !== "function") {
  throw new Error(
    "The @air-jam/server built CLI entrypoint does not export runServerCli.",
  );
}
process.exitCode = await loaded.runServerCli();
