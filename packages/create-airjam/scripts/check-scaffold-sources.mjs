#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  scaffoldSourcesRoot as legacyScaffoldSourcesRoot,
  loadScaffoldableRepoGameManifests,
  scaffoldTemplateManifestPath,
  scaffoldTemplatesRoot,
} from "./lib/scaffold-source-manifests.mjs";

const missing = [];
const expectedTemplates = loadScaffoldableRepoGameManifests().map(
  ({ manifest }) => manifest.id,
);
if (fs.existsSync(legacyScaffoldSourcesRoot)) {
  missing.push(
    "legacy scaffold-sources directory exists; packaged templates must live in scaffold-templates archives so editors do not load generated snapshots as live TypeScript projects",
  );
}

if (!fs.existsSync(scaffoldTemplateManifestPath)) {
  missing.push(`missing scaffold template manifest`);
} else {
  const index = JSON.parse(
    fs.readFileSync(scaffoldTemplateManifestPath, "utf8"),
  );
  if (index?.schemaVersion !== 1 || !Array.isArray(index.templates)) {
    missing.push(`invalid scaffold template manifest`);
  } else {
    const actualTemplates = index.templates
      .map((entry) => entry?.manifest?.id)
      .filter(Boolean)
      .sort();

    for (const templateId of actualTemplates) {
      if (!expectedTemplates.includes(templateId)) {
        missing.push(`unexpected scaffold template ${templateId}`);
      }
    }

    for (const templateId of expectedTemplates) {
      const entry = index.templates.find(
        (candidate) => candidate?.manifest?.id === templateId,
      );
      if (!entry) {
        missing.push(`missing scaffold template ${templateId}`);
        continue;
      }

      if (entry.manifest?.scaffold !== true) {
        missing.push(`scaffold template ${templateId} is not scaffold-enabled`);
      }

      if (typeof entry.archive !== "string" || entry.archive.trim() === "") {
        missing.push(`scaffold template ${templateId} is missing archive`);
        continue;
      }

      if (!fs.existsSync(path.join(scaffoldTemplatesRoot, entry.archive))) {
        missing.push(
          `scaffold template ${templateId} archive ${entry.archive} is missing`,
        );
      }
    }
  }
}

if (missing.length > 0) {
  throw new Error(missing.join("\n"));
}

console.log(
  `✓ Scaffold template archives verified in ${scaffoldTemplatesRoot}`,
);
