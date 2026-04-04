import path from "node:path";
import { repoRoot } from "../lib/paths.mjs";
import { packWorkspacePackage } from "../lib/packaging.mjs";
import { runCommand } from "../lib/shell.mjs";

export const runWorkspacePackLocalCommand = () => {
  runCommand("pnpm", ["--filter", "sdk", "build"]);
  runCommand("pnpm", ["--filter", "server", "build"]);
  runCommand("pnpm", ["--filter", "create-airjam", "build"]);

  const sdkTarball = packWorkspacePackage(path.join(repoRoot, "packages", "sdk"));
  const serverTarball = packWorkspacePackage(path.join(repoRoot, "packages", "server"));
  const cliTarball = packWorkspacePackage(
    path.join(repoRoot, "packages", "create-airjam"),
  );

  console.log("");
  console.log("Local tarballs ready:");
  console.log(`- sdk: ${sdkTarball}`);
  console.log(`- server: ${serverTarball}`);
  console.log(`- create-airjam: ${cliTarball}`);
};
