#!/usr/bin/env node

import fse from "fs-extra";
import path from "node:path";
import {
  loadScaffoldableRepoGameManifests,
  scaffoldSourcesRoot as outputRoot,
} from "./lib/scaffold-source-manifests.mjs";

const DEFAULT_EXCLUDES = new Set([
  ".airjam",
  ".bundle-analyze",
  ".DS_Store",
  ".idea",
  ".vscode",
  "coverage",
  "dist",
  "dist-ssr",
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
  await fse.remove(outputRoot);
  await fse.ensureDir(outputRoot);

  let generatedCount = 0;

  for (const { gameDir, manifest } of loadScaffoldableRepoGameManifests()) {
    const outputDir = path.join(outputRoot, manifest.id);
    const manifestExcludes = (manifest.export?.exclude ?? []).map(
      normalizePath,
    );

    await fse.copy(gameDir, outputDir, {
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

    generatedCount += 1;
  }

  console.log(
    `✓ Generated ${generatedCount} scaffold source snapshots in ${outputRoot}`,
  );
};

await main();
