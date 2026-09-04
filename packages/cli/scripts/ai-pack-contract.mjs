import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cliRoot, exportedDocs, outputDocsRoot } from "./base-docs-pack.mjs";

export const basePackRoot = path.join(cliRoot, "template-assets", "managed");
export const bootstrapPackRoot = path.join(
  cliRoot,
  "template-assets",
  "bootstrap",
);
export const aiPackManifestRelativePath = ".airjam/ai-pack.json";
export const aiPackManifestPath = path.join(
  basePackRoot,
  aiPackManifestRelativePath,
);

const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const listRelativeFiles = async (rootDir) => {
  const files = [];
  const walk = async (currentDir) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.isFile())
        files.push(path.relative(rootDir, absolutePath).replaceAll("\\", "/"));
      else
        throw new Error(
          `AI pack source must be a regular tree: ${absolutePath}.`,
        );
    }
  };
  await walk(rootDir);
  return files;
};

const classifyManagedFile = (relativePath) => {
  if (!relativePath.startsWith("docs/airjam/")) {
    throw new Error(
      `AI pack managed path is outside docs/airjam: ${relativePath}.`,
    );
  }
  return relativePath.startsWith("docs/airjam/generated/")
    ? "docs-generated"
    : "docs-local";
};

export const buildAiPackManagedFiles = async (rootDir = basePackRoot) => {
  const files = await listRelativeFiles(rootDir);
  const managedFiles = [];
  for (const relativePath of files) {
    if (relativePath === aiPackManifestRelativePath) continue;
    const content = await fs.readFile(path.join(rootDir, relativePath));
    managedFiles.push({
      path: relativePath,
      kind: classifyManagedFile(relativePath),
      size: content.length,
      sha256: sha256(content),
    });
  }
  return managedFiles;
};

export const computeAiPackContentDigest = (managedFiles) =>
  sha256(JSON.stringify(managedFiles));

const assertExactKeys = (value, expected, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} contains unsupported or missing fields.`);
  }
};

export const validateAiPackBuildManifest = ({ manifest, managedFiles }) => {
  assertExactKeys(
    manifest,
    [
      "channel",
      "contentDigest",
      "managedFiles",
      "packVersion",
      "releaseDate",
      "scaffold",
      "schemaVersion",
      "source",
    ],
    "AI pack manifest",
  );
  if (manifest.schemaVersion !== 2) {
    throw new Error("AI pack manifest schemaVersion must be 2.");
  }
  if (!semanticVersionPattern.test(String(manifest.packVersion))) {
    throw new Error("AI pack manifest packVersion must be semantic.");
  }
  if (manifest.channel !== "stable" && manifest.channel !== "canary") {
    throw new Error("AI pack manifest channel must be stable or canary.");
  }
  if (
    typeof manifest.releaseDate !== "string" ||
    !Number.isFinite(Date.parse(manifest.releaseDate))
  ) {
    throw new Error("AI pack manifest releaseDate must be a date.");
  }
  assertExactKeys(manifest.source, ["mode", "package"], "AI pack source");
  if (
    manifest.source.mode !== "packaged-snapshot" ||
    manifest.source.package !== "@air-jam/cli"
  ) {
    throw new Error("AI pack manifest must trust packaged @air-jam/cli bytes.");
  }
  if (!Array.isArray(managedFiles) || managedFiles.length === 0) {
    throw new Error("AI pack manifest must manage at least one file.");
  }
  assertExactKeys(
    manifest.scaffold,
    ["createAirjamVersion", "template"],
    "AI pack scaffold",
  );
  for (const key of ["template", "createAirjamVersion"]) {
    if (
      manifest.scaffold[key] !== null &&
      typeof manifest.scaffold[key] !== "string"
    ) {
      throw new Error(`AI pack scaffold.${key} must be a string or null.`);
    }
  }
  if (JSON.stringify(manifest.managedFiles) !== JSON.stringify(managedFiles)) {
    throw new Error(
      "AI pack managedFiles do not match the packaged file tree.",
    );
  }
  if (manifest.contentDigest !== computeAiPackContentDigest(managedFiles)) {
    throw new Error("AI pack manifest contentDigest is stale.");
  }
  return manifest;
};

export const createAiPackBuildManifest = async ({
  currentManifest,
  rootDir = basePackRoot,
}) => {
  const managedFiles = await buildAiPackManagedFiles(rootDir);
  const manifest = {
    schemaVersion: 2,
    packVersion: currentManifest.packVersion,
    channel: currentManifest.channel,
    releaseDate: currentManifest.releaseDate,
    source: { mode: "packaged-snapshot", package: "@air-jam/cli" },
    scaffold: currentManifest.scaffold ?? {
      template: null,
      createAirjamVersion: null,
    },
    managedFiles,
    contentDigest: computeAiPackContentDigest(managedFiles),
  };
  return validateAiPackBuildManifest({ manifest, managedFiles });
};

export const readVerifiedAiPackSnapshot = async (rootDir = basePackRoot) => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(rootDir, aiPackManifestRelativePath), "utf8"),
  );
  const managedFiles = await buildAiPackManagedFiles(rootDir);
  validateAiPackBuildManifest({ manifest, managedFiles });
  return { manifest, managedFiles };
};

export const requiredBasePackPaths = [
  ".airjam/ai-pack.json",
  "docs/airjam/debug-and-testing.md",
  "docs/airjam/development-loop.md",
  "docs/airjam/agent-gold-path.md",
  "docs/airjam/agent-mcp.md",
  "docs/airjam/docs-index.md",
  "docs/airjam/iconography.md",
];

export const requiredBootstrapPackPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "_gitignore",
  ".claude/launch.json",
  "skills/airjam-mcp/SKILL.md",
  "skills/index.md",
];

export const requiredGeneratedDocPaths = exportedDocs.map((entry) =>
  path.join("docs", "airjam", "generated", entry.output).replace(/\\/g, "/"),
);

export const requiredScaffoldPaths = [
  ...requiredBasePackPaths,
  ...requiredBootstrapPackPaths.filter(
    (relativePath) => relativePath !== "_gitignore",
  ),
  ".gitignore",
  ...requiredGeneratedDocPaths,
];

export { exportedDocs, outputDocsRoot };
