#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fse from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const gamesRoot = path.join(repoRoot, "games");
const outputRoot = path.join(packageRoot, "scaffold-sources");

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
  if (!fs.existsSync(gamesRoot)) {
    throw new Error(`Missing games directory at ${gamesRoot}`);
  }

  await fse.remove(outputRoot);
  await fse.ensureDir(outputRoot);

  const gameDirs = fs
    .readdirSync(gamesRoot)
    .map((entry) => path.join(gamesRoot, entry))
    .filter((entryPath) => fs.statSync(entryPath).isDirectory());

  let generatedCount = 0;

  for (const gameDir of gameDirs) {
    const manifestPath = path.join(gameDir, "airjam-template.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (typeof manifest.id !== "string" || typeof manifest.scaffold !== "boolean") {
      throw new Error(`Invalid scaffold manifest at ${manifestPath}`);
    }

    if (manifest.scaffold !== true) {
      continue;
    }

    const outputDir = path.join(outputRoot, manifest.id);
    const manifestExcludes = (manifest.export?.exclude ?? []).map(normalizePath);

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

  console.log(`✓ Generated ${generatedCount} scaffold source snapshots in ${outputRoot}`);
};

await main();
