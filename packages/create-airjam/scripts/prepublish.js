#!/usr/bin/env node
/**
 * Prepublish script for create-airjam
 *
 * Replaces workspace:* protocol with actual npm versions in template files.
 * This ensures that when the package is published, templates have the correct versions.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatesDir = join(__dirname, "../templates");
const sdkPackagePath = join(__dirname, "../../sdk/package.json");
const serverPackagePath = join(__dirname, "../../server/package.json");

async function updateTemplatePackageJson(templatePath) {
  const packageJsonPath = join(templatePath, "package.json");

  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));
    let updated = false;

    // Read SDK and server versions
    const sdkPackage = JSON.parse(await readFile(sdkPackagePath, "utf-8"));
    const serverPackage = JSON.parse(
      await readFile(serverPackagePath, "utf-8"),
    );

    // Replace @air-jam/sdk workspace dependency
    if (packageJson.dependencies?.["@air-jam/sdk"] === "workspace:*") {
      packageJson.dependencies["@air-jam/sdk"] = `^${sdkPackage.version}`;
      updated = true;
      console.log(
        `✓ Updated @air-jam/sdk to ^${sdkPackage.version} in ${templatePath}`,
      );
    }

    // Replace @air-jam/server workspace dependency
    if (packageJson.devDependencies?.["@air-jam/server"] === "workspace:*") {
      packageJson.devDependencies["@air-jam/server"] =
        `^${serverPackage.version}`;
      updated = true;
      console.log(
        `✓ Updated @air-jam/server to ^${serverPackage.version} in ${templatePath}`,
      );
    }

    if (updated) {
      await writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
        "utf-8",
      );
    }
  } catch (error) {
    console.error(`Error updating ${packageJsonPath}:`, error);
    throw error;
  }
}

async function updateTemplateViteConfig(templatePath) {
  const viteConfigPath = join(templatePath, "vite.config.ts");

  try {
    let viteConfig = await readFile(viteConfigPath, "utf-8");

    // Remove the monorepo-specific alias line (with comma after it and newline)
    const aliasPattern =
      /,\s*"@air-jam\/sdk":\s*path\.resolve\(__dirname,\s*"\.\.\/\.\.\/\.\.\/sdk\/src"\)\s*/;

    if (aliasPattern.test(viteConfig)) {
      viteConfig = viteConfig.replace(aliasPattern, "");
      await writeFile(viteConfigPath, viteConfig, "utf-8");
      console.log(
        `✓ Removed monorepo alias from vite.config.ts in ${templatePath}`,
      );
    }
  } catch (error) {
    console.error(`Error updating ${viteConfigPath}:`, error);
    throw error;
  }
}

async function main() {
  try {
    // Update all template package.json files
    const { readdir } = await import("node:fs/promises");
    const templates = await readdir(templatesDir, { withFileTypes: true });

    for (const template of templates) {
      if (template.isDirectory()) {
        const templatePath = join(templatesDir, template.name);
        await updateTemplatePackageJson(templatePath);
        await updateTemplateViteConfig(templatePath);
      }
    }

    console.log("✓ All template files updated for publishing");
  } catch (error) {
    console.error("Error in prepublish script:", error);
    process.exit(1);
  }
}

main();
