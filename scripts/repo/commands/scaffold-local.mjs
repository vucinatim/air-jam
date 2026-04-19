import fs from "node:fs";
import path from "node:path";
import { packWorkspacePackage } from "../lib/packaging.mjs";
import { createAirjamCliEntry, repoRoot } from "../lib/paths.mjs";
import { runCommand } from "../lib/shell.mjs";

export const runRepoScaffoldLocalCommand = ({
  projectName,
  source = "tarball",
  template = "pong",
  cwd = process.cwd(),
} = {}) => {
  if (!projectName) {
    throw new Error(
      "Usage: pnpm run repo -- scaffold local <project-name> [--source <tarball|workspace|registry>] [--template <id>]",
    );
  }

  if (!["tarball", "workspace", "registry"].includes(source)) {
    throw new Error(`Unsupported --source value "${source}"`);
  }

  runCommand("pnpm", ["--filter", "create-airjam", "build"]);

  const commandArgs = [
    createAirjamCliEntry,
    projectName,
    "--template",
    template,
  ];

  if (source === "tarball") {
    runCommand("pnpm", ["--filter", "sdk", "build"]);
    runCommand("pnpm", ["--filter", "server", "build"]);

    const sdkTarball = packWorkspacePackage(
      path.join(repoRoot, "packages", "sdk"),
    );
    const serverTarball = packWorkspacePackage(
      path.join(repoRoot, "packages", "server"),
    );

    commandArgs.push("--dep-spec", `@air-jam/sdk=file:${sdkTarball}`);
    commandArgs.push("--dep-spec", `@air-jam/server=file:${serverTarball}`);
    commandArgs.push("--override-spec", `@air-jam/sdk=file:${sdkTarball}`);
  } else if (source === "workspace") {
    runCommand("pnpm", ["--filter", "sdk", "build"]);
    runCommand("pnpm", ["--filter", "server", "build"]);

    const sdkPackageJson = JSON.parse(
      fs.readFileSync(
        path.join(repoRoot, "packages", "sdk", "package.json"),
        "utf-8",
      ),
    );

    commandArgs.push(
      "--dep-spec",
      `@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`,
    );
    commandArgs.push(
      "--dep-spec",
      `@air-jam/server=link:${path.join(repoRoot, "packages", "server")}`,
    );
    commandArgs.push(
      "--dep-spec",
      `zod=${String(sdkPackageJson.dependencies?.zod ?? "").replace(/^[~^]/, "")}`,
    );
    commandArgs.push(
      "--override-spec",
      `@air-jam/sdk=link:${path.join(repoRoot, "packages", "sdk")}`,
    );
  }

  runCommand("node", commandArgs, { cwd });
};
