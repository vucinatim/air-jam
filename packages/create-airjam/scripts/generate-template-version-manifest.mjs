#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePublicPackages } from "../../../scripts/release/public-packages.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, "..");
const repoPackageJsonPath = path.resolve(packageRoot, "../../package.json");
const manifestPath = path.join(packageRoot, "template-version-manifest.json");

const readPackageManager = (filePath) => {
  const packageJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!/^pnpm@\d+\.\d+\.\d+$/u.test(packageJson.packageManager ?? "")) {
    throw new Error(`Missing canonical pnpm packageManager in ${filePath}`);
  }
  return packageJson.packageManager;
};

const manifest = {
  packageManager: readPackageManager(repoPackageJsonPath),
  packages: Object.fromEntries(
    resolvePublicPackages().map((entry) => [entry.packageName, entry.version]),
  ),
};

const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (
    !fs.existsSync(manifestPath) ||
    fs.readFileSync(manifestPath, "utf8") !== serializedManifest
  ) {
    throw new Error(
      `Template version manifest is stale; run node scripts/generate-template-version-manifest.mjs`,
    );
  }
  console.log(`✓ Template version manifest is current at ${manifestPath}`);
} else {
  fs.writeFileSync(manifestPath, serializedManifest, "utf-8");
  console.log(`✓ Wrote template version manifest to ${manifestPath}`);
}
