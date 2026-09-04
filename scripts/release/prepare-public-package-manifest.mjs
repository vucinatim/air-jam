#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { preparePublicPackageManifestFile } from "./public-package-manifest.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const packageDir = process.cwd();
const packageJsonPath = path.join(packageDir, "package.json");
const backupPath = path.join(packageDir, ".package.json.publish-backup");
const main = () => {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`No package.json found in ${packageDir}`);
  }

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(packageJsonPath, backupPath);
  }

  const source = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = preparePublicPackageManifestFile({
    repoRoot,
    packageDir,
  });
  const preparedSource = `${JSON.stringify(packageJson, null, 2)}\n`;
  if (preparedSource !== source)
    fs.writeFileSync(packageJsonPath, preparedSource);
};

main();
