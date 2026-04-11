#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, "..");
const createAirJamPackageJsonPath = path.resolve(packageRoot, "package.json");
const sdkPackageJsonPath = path.resolve(packageRoot, "../sdk/package.json");
const serverPackageJsonPath = path.resolve(packageRoot, "../server/package.json");
const visualHarnessPackageJsonPath = path.resolve(
  packageRoot,
  "../visual-harness/package.json",
);
const manifestPath = path.join(packageRoot, "template-version-manifest.json");

const readPackageVersion = (filePath) => {
  const packageJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!packageJson.version) {
    throw new Error(`Missing version in ${filePath}`);
  }
  return packageJson.version;
};

const manifest = {
  "create-airjam": readPackageVersion(createAirJamPackageJsonPath),
  "@air-jam/sdk": readPackageVersion(sdkPackageJsonPath),
  "@air-jam/server": readPackageVersion(serverPackageJsonPath),
  "@air-jam/visual-harness": readPackageVersion(visualHarnessPackageJsonPath),
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
console.log(`✓ Wrote template version manifest to ${manifestPath}`);
