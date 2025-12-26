#!/usr/bin/env node
/**
 * Prepublish script for @air-jam/server
 * 
 * Replaces workspace:* protocol with actual SDK version for publishing.
 * This allows us to use the workspace SDK locally but publish with the npm version.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPackagePath = join(__dirname, "../package.json");
const sdkPackagePath = join(__dirname, "../../sdk/package.json");

async function main() {
  try {
    // Read SDK package.json to get version
    const sdkPackage = JSON.parse(await readFile(sdkPackagePath, "utf-8"));
    const sdkVersion = sdkPackage.version;

    if (!sdkVersion) {
      throw new Error("SDK package.json missing version");
    }

    // Read server package.json
    const serverPackage = JSON.parse(await readFile(serverPackagePath, "utf-8"));

    // Replace workspace:* with actual version
    if (serverPackage.dependencies?.["@air-jam/sdk"] === "workspace:*") {
      serverPackage.dependencies["@air-jam/sdk"] = `^${sdkVersion}`;
      
      // Write back
      await writeFile(
        serverPackagePath,
        JSON.stringify(serverPackage, null, 2) + "\n",
        "utf-8"
      );

      console.log(`✓ Updated @air-jam/sdk dependency to ^${sdkVersion} for publishing`);
    }
  } catch (error) {
    console.error("Error in prepublish script:", error);
    process.exit(1);
  }
}

main();

