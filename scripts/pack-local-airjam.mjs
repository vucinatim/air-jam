import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const tarballDir = path.join(repoRoot, ".airjam", "tarballs");

const run = (command, cwd = repoRoot) => {
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
  });
};

const packWorkspacePackage = (packageDir) => {
  fs.mkdirSync(tarballDir, { recursive: true });
  const before = new Set(fs.readdirSync(tarballDir));
  run(`pnpm pack --pack-destination ${JSON.stringify(tarballDir)}`, packageDir);
  const created = fs
    .readdirSync(tarballDir)
    .filter((name) => name.endsWith(".tgz") && !before.has(name))
    .sort();

  if (created.length === 0) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }

  return path.join(tarballDir, created[created.length - 1]);
};

const main = () => {
  run("pnpm --filter sdk build");
  run("pnpm --filter server build");
  run("pnpm --filter create-airjam build");

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

main();
