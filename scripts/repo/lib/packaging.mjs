import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tarballDir, tarballSetsDir } from "./paths.mjs";
import { runCommand } from "./shell.mjs";

export const toTarballBaseName = (packageName) =>
  packageName.replace(/^@/, "").replace(/\//g, "-");

const toTarballSetTimestamp = (date = new Date()) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export const createTarballSetDir = ({ prefix = "local" } = {}) => {
  fs.mkdirSync(tarballSetsDir, { recursive: true });

  const setId = `${prefix}-${toTarballSetTimestamp()}-${randomUUID().slice(0, 8)}`;
  const setDir = path.join(tarballSetsDir, setId);
  fs.mkdirSync(setDir, { recursive: false });

  return {
    setDir,
    setId,
  };
};

export const writeTarballSetManifest = ({ setDir, setId, tarballs }) => {
  const manifestPath = path.join(setDir, "manifest.json");
  const packages = Object.fromEntries(
    [...tarballs.entries()].map(([packageName, tarballPath]) => [
      packageName,
      path.basename(tarballPath),
    ]),
  );

  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        setId,
        createdAt: new Date().toISOString(),
        packages,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return manifestPath;
};

export const packWorkspacePackage = (packageDir, { outDir = tarballDir } = {}) => {
  fs.mkdirSync(outDir, { recursive: true });

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(packageDir, "package.json"), "utf8"),
  );

  const expectedTarball = `${toTarballBaseName(packageJson.name)}-${packageJson.version}.tgz`;
  const tarballPath = path.join(outDir, expectedTarball);

  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }

  runCommand("pnpm", ["pack", "--pack-destination", outDir], {
    cwd: packageDir,
  });

  if (!fs.existsSync(tarballPath)) {
    throw new Error(`No tarball produced for package at ${packageDir}`);
  }

  return tarballPath;
};
