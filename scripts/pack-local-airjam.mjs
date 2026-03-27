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

const toTarballBaseName = (packageName) =>
  packageName.replace(/^@/, "").replace(/\//g, "-");

const packWorkspacePackage = (packageDir) => {
  fs.mkdirSync(tarballDir, { recursive: true });
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
  );
  const expectedTarball = `${toTarballBaseName(packageJson.name)}-${packageJson.version}.tgz`;
  const tarballPath = path.join(tarballDir, expectedTarball);

  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }

  run(`pnpm pack --pack-destination ${JSON.stringify(tarballDir)}`, packageDir);

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }

  return tarballPath;
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
