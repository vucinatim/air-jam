import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  basePackRoot,
  exportedDocs,
  outputDocsRoot,
  requiredBasePackPaths,
  requiredGeneratedDocPaths,
} from "./ai-pack-contract.mjs";
import { generateBaseDocsPack } from "./base-docs-pack.mjs";

const listRelativeFiles = async (rootDir) => {
  const files = [];

  const walk = async (currentDir) => {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      files.push(path.relative(rootDir, absolutePath).replace(/\\/g, "/"));
    }
  };

  await walk(rootDir);
  return files;
};

const validateRequiredPaths = () =>
  [...requiredBasePackPaths, ...requiredGeneratedDocPaths]
    .filter((relativePath) => !fs.existsSync(path.join(basePackRoot, relativePath)))
    .map((relativePath) => `Missing required AI pack file: ${relativePath}`);

const validateManifestShape = async () => {
  const manifestPath = path.join(basePackRoot, ".airjam", "ai-pack.json");
  const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  const errors = [];

  if (manifest.schemaVersion !== 1) {
    errors.push("AI pack manifest must set schemaVersion to 1.");
  }
  if (typeof manifest.packVersion !== "string" || manifest.packVersion.length === 0) {
    errors.push("AI pack manifest must include a non-empty packVersion.");
  }
  if (manifest.channel !== "stable" && manifest.channel !== "canary") {
    errors.push('AI pack manifest channel must be "stable" or "canary".');
  }
  if (typeof manifest.releaseDate !== "string" || manifest.releaseDate.length === 0) {
    errors.push("AI pack manifest must include a non-empty releaseDate.");
  }
  if (manifest.source?.mode !== "packaged-snapshot") {
    errors.push('AI pack manifest source.mode must be "packaged-snapshot".');
  }
  if (typeof manifest.update?.manifestUrl !== "string") {
    errors.push("AI pack manifest must include update.manifestUrl.");
  }
  if (typeof manifest.update?.docsBaseUrl !== "string") {
    errors.push("AI pack manifest must include update.docsBaseUrl.");
  }

  return errors;
};

const validateGeneratedDirectoryShape = async () => {
  const allowedFiles = new Set(exportedDocs.map((entry) => entry.output));
  const actualFiles = await listRelativeFiles(outputDocsRoot);

  return actualFiles
    .filter((relativePath) => !allowedFiles.has(relativePath))
    .map((relativePath) => `Unexpected generated docs file: docs/generated/${relativePath}`);
};

const validateGeneratedDocsFreshness = async () => {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "airjam-docs-pack-check-"));

  try {
    await generateBaseDocsPack(tempRoot);

    const expectedFiles = exportedDocs.map((entry) => entry.output).sort();
    const actualFiles = (await fsp.readdir(outputDocsRoot))
      .filter((name) => name.endsWith(".md"))
      .sort();

    const errors = [];

    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      errors.push(
        `Generated docs file set is stale. Expected [${expectedFiles.join(", ")}], found [${actualFiles.join(", ")}].`,
      );
    }

    for (const fileName of expectedFiles) {
      const expectedContents = await fsp.readFile(path.join(tempRoot, fileName), "utf8");
      const actualPath = path.join(outputDocsRoot, fileName);

      if (!fs.existsSync(actualPath)) {
        errors.push(`Generated docs file missing: docs/generated/${fileName}`);
        continue;
      }

      const actualContents = await fsp.readFile(actualPath, "utf8");
      if (actualContents !== expectedContents) {
        errors.push(
          `Generated docs are stale for docs/generated/${fileName}. Run "pnpm --filter create-airjam docs-pack:generate".`,
        );
      }
    }

    return errors;
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
};

const main = async () => {
  const errors = [
    ...validateRequiredPaths(),
    ...(await validateManifestShape()),
    ...(await validateGeneratedDirectoryShape()),
    ...(await validateGeneratedDocsFreshness()),
  ];

  if (errors.length > 0) {
    console.error("AI pack validation failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("✓ AI pack is complete and fresh");
};

await main();
