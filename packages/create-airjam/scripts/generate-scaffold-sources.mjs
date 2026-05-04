#!/usr/bin/env node

import fse from "fs-extra";
import os from "node:os";
import path from "node:path";
import {
  loadScaffoldableRepoGameManifests,
  scaffoldTemplatesRoot as outputRoot,
  scaffoldSourcesRoot,
  scaffoldTemplateManifestPath,
} from "./lib/scaffold-source-manifests.mjs";
import { writeTemplateArchive } from "./lib/template-archive.mjs";

const DEFAULT_EXCLUDES = new Set([
  ".airjam",
  ".bundle-analyze",
  ".DS_Store",
  ".idea",
  ".vscode",
  "coverage",
  "dist",
  "dist-ssr",
  "airjam-template.json",
  "node_modules",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.tsbuildinfo",
  "yarn.lock",
]);

const normalizePath = (value) => value.replace(/\\/g, "/");

const shouldExclude = ({ relativePath, basename, manifestExcludes }) => {
  const normalizedRelativePath = normalizePath(relativePath);
  const firstSegment = normalizedRelativePath.split("/")[0];

  if (!normalizedRelativePath || normalizedRelativePath === ".") {
    return false;
  }

  if (basename.startsWith(".env") && basename !== ".env.example") {
    return true;
  }

  if (basename.endsWith(".local")) {
    return true;
  }

  if (DEFAULT_EXCLUDES.has(basename) || DEFAULT_EXCLUDES.has(firstSegment)) {
    return true;
  }

  return manifestExcludes.some(
    (entry) =>
      normalizedRelativePath === entry ||
      normalizedRelativePath.startsWith(`${entry}/`) ||
      basename === entry ||
      firstSegment === entry,
  );
};

const main = async () => {
  await fse.remove(scaffoldSourcesRoot);
  await fse.remove(outputRoot);
  await fse.ensureDir(outputRoot);

  const templateIndex = {
    schemaVersion: 1,
    templates: [],
  };
  let generatedCount = 0;

  for (const { gameDir, manifest } of loadScaffoldableRepoGameManifests()) {
    const tempRoot = await fse.mkdtemp(
      path.join(os.tmpdir(), `airjam-template-${manifest.id}-`),
    );
    const manifestExcludes = (manifest.export?.exclude ?? []).map(
      normalizePath,
    );

    try {
      await fse.copy(gameDir, tempRoot, {
        filter: (src) => {
          const relativePath = path.relative(gameDir, src);
          if (!relativePath) {
            return true;
          }

          return !shouldExclude({
            relativePath,
            basename: path.basename(src),
            manifestExcludes,
          });
        },
      });

      const archive = `${manifest.id}.zip`;
      await writeTemplateArchive({
        sourceDir: tempRoot,
        outputFile: path.join(outputRoot, archive),
      });
      templateIndex.templates.push({
        archive,
        manifest,
      });
    } finally {
      await fse.remove(tempRoot);
    }

    generatedCount += 1;
  }

  await fse.writeJson(scaffoldTemplateManifestPath, templateIndex, {
    spaces: 2,
  });

  console.log(
    `✓ Generated ${generatedCount} scaffold template archives in ${outputRoot}`,
  );
};

await main();
