import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  basePackRoot,
  exportedDocs,
  outputDocsRoot,
  readVerifiedAiPackSnapshot,
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
    .filter(
      (relativePath) => !fs.existsSync(path.join(basePackRoot, relativePath)),
    )
    .map((relativePath) => `Missing required AI pack file: ${relativePath}`);

const validateManifestShape = async () => {
  try {
    await readVerifiedAiPackSnapshot();
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
};

const validateGeneratedDirectoryShape = async () => {
  const allowedFiles = new Set(exportedDocs.map((entry) => entry.output));
  const actualFiles = await listRelativeFiles(outputDocsRoot);

  return actualFiles
    .filter((relativePath) => !allowedFiles.has(relativePath))
    .map(
      (relativePath) =>
        `Unexpected generated docs file: docs/airjam/generated/${relativePath}`,
    );
};

const validateGeneratedDocsFreshness = async () => {
  const tempRoot = await fsp.mkdtemp(
    path.join(os.tmpdir(), "airjam-docs-pack-check-"),
  );

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
      const expectedContents = await fsp.readFile(
        path.join(tempRoot, fileName),
        "utf8",
      );
      const actualPath = path.join(outputDocsRoot, fileName);

      if (!fs.existsSync(actualPath)) {
        errors.push(
          `Generated docs file missing: docs/airjam/generated/${fileName}`,
        );
        continue;
      }

      const actualContents = await fsp.readFile(actualPath, "utf8");
      if (actualContents !== expectedContents) {
        errors.push(
          `Generated docs are stale for docs/airjam/generated/${fileName}. Run "pnpm --filter @air-jam/cli docs-pack:generate".`,
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
