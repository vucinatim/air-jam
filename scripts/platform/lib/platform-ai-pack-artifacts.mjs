import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  basePackRoot,
  listRelativeFiles,
  readVerifiedAiPackSnapshot,
} from "../../../packages/cli/scripts/ai-pack-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");

export const platformPublicAiPackRoot = path.join(
  repoRoot,
  "apps",
  "platform",
  "public",
  "ai-pack",
);

export async function generatePlatformAiPackArtifacts({
  targetRoot = platformPublicAiPackRoot,
} = {}) {
  const { manifest, managedFiles } = await readVerifiedAiPackSnapshot();
  const filesRoot = path.join(targetRoot, "files");

  await fs.rm(targetRoot, { recursive: true, force: true });
  await fs.mkdir(filesRoot, { recursive: true });

  for (const { path: relativePath } of managedFiles) {
    const sourcePath = path.join(basePackRoot, relativePath);
    const targetPath = path.join(filesRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
  await fs.writeFile(
    path.join(targetRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return {
    channel: manifest.channel,
    packVersion: manifest.packVersion,
    contentDigest: manifest.contentDigest,
    fileCount: managedFiles.length,
    targetRoot,
  };
}

export async function readRelativeTree(rootDir) {
  const files = await listRelativeFiles(rootDir);
  const entries = new Map();

  for (const relativePath of files) {
    entries.set(
      relativePath,
      await fs.readFile(path.join(rootDir, relativePath), "utf8"),
    );
  }

  return entries;
}
