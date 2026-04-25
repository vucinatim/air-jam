#!/usr/bin/env node

import fse from "fs-extra";
import os from "node:os";
import path from "node:path";
import yazl from "yazl";
import {
  loadScaffoldableRepoGameManifests,
  scaffoldTemplatesRoot as outputRoot,
  scaffoldSourcesRoot,
  scaffoldTemplateManifestPath,
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

const collectFiles = async (sourceDir) => {
  const entries = await fse.readdir(sourceDir);
  const files = [];

  for (const entry of entries.sort()) {
    const absolutePath = path.join(sourceDir, entry);
    const stats = await fse.stat(absolutePath);
    if (stats.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }
    files.push(absolutePath);
  }

  return files;
};

const writeTemplateArchive = async ({ sourceDir, outputFile }) => {
  const files = await collectFiles(sourceDir);
  const zipFile = new yazl.ZipFile();

  await fse.ensureDir(path.dirname(outputFile));

  const output = fse.createWriteStream(outputFile);
  const closePromise = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  zipFile.outputStream.pipe(output);

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    if (!relativePath) {
      continue;
    }
    zipFile.addFile(filePath, relativePath);
  }

  zipFile.end();
  await closePromise;
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
