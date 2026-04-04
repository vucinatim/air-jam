import fs from "node:fs";
import path from "node:path";
import { tarballDir } from "./paths.mjs";
import { runCommand } from "./shell.mjs";

export const toTarballBaseName = (packageName) =>
  packageName.replace(/^@/, "").replace(/\//g, "-");

export const packWorkspacePackage = (packageDir) => {
  fs.mkdirSync(tarballDir, { recursive: true });

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
  );

  const expectedTarball = `${toTarballBaseName(packageJson.name)}-${packageJson.version}.tgz`;
  const tarballPath = path.join(tarballDir, expectedTarball);

  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }

  runCommand("pnpm", ["pack", "--pack-destination", tarballDir], {
    cwd: packageDir,
  });

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }

  return tarballPath;
};
