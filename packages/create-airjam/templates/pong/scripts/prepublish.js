#!/usr/bin/env node
/**
 * Prepublish script for Air Jam games
 *
 * Replaces workspace:* protocol with actual npm versions for publishing.
 * Removes monorepo-specific source file resolutions from vite.config.ts and tsconfig.json.
 * This allows us to use the workspace SDK/server locally but publish with npm versions.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const gamePackagePath = join(__dirname, "../package.json");
const viteConfigPath = join(__dirname, "../vite.config.ts");
const tsconfigPath = join(__dirname, "../tsconfig.json");

async function getPackageVersion(packageName) {
  try {
    // Try to read from node_modules (when installed)
    const nodeModulesPath = join(
      __dirname,
      "../node_modules",
      packageName,
      "package.json",
    );
    const packageJson = JSON.parse(await readFile(nodeModulesPath, "utf-8"));
    return packageJson.version;
  } catch (error) {
    // If not in node_modules, try to find it in the monorepo structure
    // This handles the case when running in the monorepo
    try {
      const monorepoPath = join(
        __dirname,
        "../../../../",
        packageName.replace("@air-jam/", ""),
        "package.json",
      );
      const packageJson = JSON.parse(await readFile(monorepoPath, "utf-8"));
      return packageJson.version;
    } catch (monorepoError) {
      throw new Error(
        `Could not find version for ${packageName}. Make sure it's installed.`,
      );
    }
  }
}

async function removeMonorepoPaths() {
  try {
    // Remove SDK alias from vite.config.ts
    let viteConfig = await readFile(viteConfigPath, "utf-8");
    const originalViteConfig = viteConfig;

    // Remove lines containing the SDK alias and its comments
    const lines = viteConfig.split("\n");
    const filteredLines = [];
    let skipNext = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comment lines about SDK source resolution
      if (
        line.includes("Resolve SDK to source files") ||
        line.includes("This only works when running in the monorepo")
      ) {
        skipNext = true;
        continue;
      }
      // Skip the actual SDK alias line
      if (
        line.includes('"@air-jam/sdk"') &&
        line.includes("../../../sdk/src")
      ) {
        continue;
      }
      filteredLines.push(line);
    }

    viteConfig = filteredLines.join("\n");

    if (viteConfig !== originalViteConfig) {
      await writeFile(viteConfigPath, viteConfig, "utf-8");
      console.log("✓ Removed monorepo SDK alias from vite.config.ts");
    }
  } catch (error) {
    console.warn("Warning: Could not update vite.config.ts:", error.message);
  }

  try {
    // Remove SDK paths from tsconfig.json
    const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf-8"));
    let updated = false;

    if (tsconfig.compilerOptions?.paths) {
      // Remove @air-jam/sdk paths
      if (tsconfig.compilerOptions.paths["@air-jam/sdk"]) {
        delete tsconfig.compilerOptions.paths["@air-jam/sdk"];
        updated = true;
      }
      if (tsconfig.compilerOptions.paths["@air-jam/sdk/*"]) {
        delete tsconfig.compilerOptions.paths["@air-jam/sdk/*"];
        updated = true;
      }
    }

    // Remove SDK source from include array
    if (Array.isArray(tsconfig.include)) {
      const originalLength = tsconfig.include.length;
      tsconfig.include = tsconfig.include.filter(
        (item) => !item.includes("../../../sdk/src"),
      );
      if (tsconfig.include.length !== originalLength) {
        updated = true;
      }
    }

    if (updated) {
      await writeFile(
        tsconfigPath,
        JSON.stringify(tsconfig, null, 2) + "\n",
        "utf-8",
      );
      console.log("✓ Removed monorepo SDK paths from tsconfig.json");
    }
  } catch (error) {
    console.warn("Warning: Could not update tsconfig.json:", error.message);
  }
}

async function main() {
  try {
    // Read game package.json
    const gamePackage = JSON.parse(await readFile(gamePackagePath, "utf-8"));
    let updated = false;

    // Update @air-jam/sdk in dependencies
    if (gamePackage.dependencies?.["@air-jam/sdk"] === "workspace:*") {
      const sdkVersion = await getPackageVersion("@air-jam/sdk");
      gamePackage.dependencies["@air-jam/sdk"] = `^${sdkVersion}`;
      updated = true;
      console.log(
        `✓ Updated @air-jam/sdk dependency to ^${sdkVersion} for publishing`,
      );
    }

    // Update @air-jam/server in devDependencies
    if (gamePackage.devDependencies?.["@air-jam/server"] === "workspace:*") {
      const serverVersion = await getPackageVersion("@air-jam/server");
      gamePackage.devDependencies["@air-jam/server"] = `^${serverVersion}`;
      updated = true;
      console.log(
        `✓ Updated @air-jam/server devDependency to ^${serverVersion} for publishing`,
      );
    }

    if (updated) {
      // Write back
      await writeFile(
        gamePackagePath,
        JSON.stringify(gamePackage, null, 2) + "\n",
        "utf-8",
      );
    } else {
      console.log("No workspace dependencies to update");
    }

    // Remove monorepo-specific paths from config files
    await removeMonorepoPaths();
  } catch (error) {
    console.error("Error in prepublish script:", error);
    process.exit(1);
  }
}

main();
