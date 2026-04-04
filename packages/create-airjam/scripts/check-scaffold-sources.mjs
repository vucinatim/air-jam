#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  loadScaffoldableRepoGameManifests,
  scaffoldSourcesRoot as scaffoldRoot,
} from "./lib/scaffold-source-manifests.mjs";

const missing = [];
const expectedTemplates = loadScaffoldableRepoGameManifests().map(
  ({ manifest }) => manifest.id,
);
const actualTemplates = fs.existsSync(scaffoldRoot)
  ? fs
      .readdirSync(scaffoldRoot)
      .filter((entry) =>
        fs.statSync(path.join(scaffoldRoot, entry)).isDirectory(),
      )
      .sort()
  : [];

for (const templateId of actualTemplates) {
  if (!expectedTemplates.includes(templateId)) {
    missing.push(`unexpected scaffold source ${templateId}`);
  }
}

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

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest?.id !== templateId) {
      missing.push(`scaffold source ${templateId} has mismatched manifest id`);
    }
    if (manifest?.scaffold !== true) {
      missing.push(`scaffold source ${templateId} is not scaffold-enabled`);
    }
  }
}

if (missing.length > 0) {
  throw new Error(missing.join("\n"));
}

console.log(`✓ Scaffold source snapshots verified in ${scaffoldRoot}`);
