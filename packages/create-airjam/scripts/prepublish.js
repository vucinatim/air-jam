#!/usr/bin/env node
/**
 * Prepublish script for create-airjam
 *
 * Keep templates publish-clean without mutating their canonical source.
 * Dependency source resolution happens at scaffold time, not publish time.
 */

import { access, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templatesDir = join(__dirname, "../templates");

async function cleanupTemplateArtifacts(templatePath) {
  const removablePaths = ["node_modules", "dist", "dist-ssr"];

  for (const relativePath of removablePaths) {
    const artifactPath = join(templatePath, relativePath);
    await rm(artifactPath, { recursive: true, force: true });
  }
}

async function main() {
  try {
    // Newer scaffold packaging ships generated archives instead of a raw templates directory.
    // Keep the legacy cleanup path for older local layouts, but treat its absence as a valid no-op.
    await access(templatesDir);
    const templates = await readdir(templatesDir, { withFileTypes: true });

    for (const template of templates) {
      if (template.isDirectory()) {
        const templatePath = join(templatesDir, template.name);
        await cleanupTemplateArtifacts(templatePath);
      }
    }

    console.log("✓ Template artifacts cleaned for publishing");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      console.log("✓ No legacy templates directory to clean for publishing");
      return;
    }
    console.error("Error in prepublish script:", error);
    process.exit(1);
  }
}

main();
