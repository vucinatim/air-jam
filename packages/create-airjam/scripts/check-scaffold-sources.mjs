#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, "..");
const scaffoldRoot = path.join(packageRoot, "scaffold-sources");
const expectedTemplates = ["pong", "air-capture"];

const missing = [];

for (const templateId of expectedTemplates) {
  const templateRoot = path.join(scaffoldRoot, templateId);
  const manifestPath = path.join(templateRoot, "airjam-template.json");
  const packageJsonPath = path.join(templateRoot, "package.json");

  if (!fs.existsSync(templateRoot)) {
    missing.push(`missing scaffold source ${templateId}`);
    continue;
  }

  if (!fs.existsSync(manifestPath)) {
    missing.push(`missing manifest for ${templateId}`);
  }

  if (!fs.existsSync(packageJsonPath)) {
    missing.push(`missing package.json for ${templateId}`);
  }

  if (fs.existsSync(path.join(templateRoot, "node_modules"))) {
    missing.push(`scaffold source ${templateId} still contains node_modules`);
  }

  if (fs.existsSync(path.join(templateRoot, "dist"))) {
    missing.push(`scaffold source ${templateId} still contains dist`);
  }
}

if (missing.length > 0) {
  throw new Error(missing.join("\n"));
}

console.log(`✓ Scaffold source snapshots verified in ${scaffoldRoot}`);
