import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { basePackRoot } from "../../packages/create-airjam/scripts/ai-pack-contract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

export const platformPublicAiPackRoot = path.join(
  repoRoot,
  "apps",
  "platform",
  "public",
  "ai-pack",
);

const createAirJamPackageJsonPath = path.join(
  repoRoot,
  "packages",
  "create-airjam",
  "package.json",
);
const templateVersionManifestPath = path.join(
  repoRoot,
  "packages",
  "create-airjam",
  "template-version-manifest.json",
);
const baseAiPackManifestPath = path.join(basePackRoot, ".airjam", "ai-pack.json");

const readJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, "utf8"));

const listFiles = async (rootDir) => {
  const files = [];

  const walk = async (currentDir) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
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

const encodeArtifactPath = (relativePath) =>
  relativePath
    .split("/")
    .map((segment) =>
      segment.startsWith(".") ? `__dot__${segment.slice(1)}` : segment,
    )
    .join("/");

const classifyFileKind = (relativePath) => {
  if (relativePath === ".airjam/ai-pack.json") {
    return "manifest";
  }
  if (relativePath.startsWith("skills/")) {
    return "skill";
  }
  if (relativePath.startsWith("docs/generated/")) {
    return "docs-generated";
  }
  if (relativePath.startsWith("docs/")) {
    return "docs-local";
  }
  return "root";
};

const sha256ForFile = async (filePath) => {
  const contents = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(contents).digest("hex");
};

export async function generatePlatformAiPackArtifacts({
  targetRoot = platformPublicAiPackRoot,
  siteUrl = "https://air-jam.app",
} = {}) {
  const baseManifest = await readJson(baseAiPackManifestPath);
  const createAirJamPackage = await readJson(createAirJamPackageJsonPath);
  const templateVersionManifest = await readJson(templateVersionManifestPath);
  const releaseDate = baseManifest.releaseDate;
  const generatedAt = releaseDate;
  const channel = baseManifest.channel;
  const packVersion = baseManifest.packVersion;
  const channelRoot = path.join(targetRoot, channel);
  const versionRoot = path.join(channelRoot, packVersion);
  const filesRoot = path.join(versionRoot, "files");

  await fs.rm(targetRoot, { recursive: true, force: true });
  await fs.mkdir(filesRoot, { recursive: true });

  const sourceFiles = await listFiles(basePackRoot);
  const fileEntries = [];

  for (const relativePath of sourceFiles) {
    const sourcePath = path.join(basePackRoot, relativePath);
    const artifactPath = encodeArtifactPath(relativePath);
    const targetPath = path.join(filesRoot, artifactPath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);

    const stats = await fs.stat(sourcePath);
    const artifactRelativeUrl = `${channel}/${packVersion}/files/${artifactPath}`;
    fileEntries.push({
      path: relativePath,
      artifactPath: artifactRelativeUrl,
      kind: classifyFileKind(relativePath),
      size: stats.size,
      sha256: await sha256ForFile(sourcePath),
      url: `${siteUrl}/ai-pack/${artifactRelativeUrl}`,
    });
  }

  const versionManifest = {
    schemaVersion: 1,
    generatedAt,
    releaseDate,
    channel,
    packVersion,
    createAirJamVersion: createAirJamPackage.version,
    templateVersions: templateVersionManifest,
    docsBaseUrl: `${siteUrl}/docs`,
    fileBaseUrl: `${siteUrl}/ai-pack/${channel}/${packVersion}/files/`,
    canonicalSources: {
      docs: "content/docs",
      basePack: "packages/create-airjam/template-assets/base",
    },
    files: fileEntries,
  };

  const channelManifest = {
    schemaVersion: 1,
    generatedAt,
    channel,
    latestPackVersion: packVersion,
    latestManifestUrl: `${siteUrl}/ai-pack/${channel}/${packVersion}/manifest.json`,
    versions: [
      {
        packVersion,
        releaseDate,
        manifestUrl: `${siteUrl}/ai-pack/${channel}/${packVersion}/manifest.json`,
        createAirJamVersion: createAirJamPackage.version,
        fileCount: fileEntries.length,
      },
    ],
  };

  const rootManifest = {
    schemaVersion: 1,
    generatedAt,
    channels: {
      [channel]: {
        latestPackVersion: packVersion,
        manifestUrl: `${siteUrl}/ai-pack/${channel}/manifest.json`,
        latestVersionManifestUrl: `${siteUrl}/ai-pack/${channel}/${packVersion}/manifest.json`,
        createAirJamVersion: createAirJamPackage.version,
        releaseDate,
        fileCount: fileEntries.length,
      },
    },
  };

  await fs.mkdir(channelRoot, { recursive: true });
  await fs.writeFile(
    path.join(versionRoot, "manifest.json"),
    `${JSON.stringify(versionManifest, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(channelRoot, "manifest.json"),
    `${JSON.stringify(channelManifest, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(targetRoot, "manifest.json"),
    `${JSON.stringify(rootManifest, null, 2)}\n`,
    "utf8",
  );

  return {
    generatedAt,
    channel,
    packVersion,
    fileCount: fileEntries.length,
    targetRoot,
  };
}

export async function readRelativeTree(rootDir) {
  const files = await listFiles(rootDir);
  const entries = new Map();

  for (const relativePath of files) {
    entries.set(
      relativePath,
      await fs.readFile(path.join(rootDir, relativePath), "utf8"),
    );
  }

  return entries;
}
