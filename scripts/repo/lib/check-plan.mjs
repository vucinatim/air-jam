import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";

export const fastCheckTargets = Object.freeze({
  instantWarmMs: 1_000,
  changedWarmMs: 5_000,
  maxChangedTypecheckProjects: 4,
});

const lintExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const nodeSyntaxExtensions = new Set([".cjs", ".js", ".mjs"]);
const batchInvalidators = new Set([
  "eslint.config.js",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
]);

const normalizePath = (value) => value.split(path.sep).join("/");

const listOneLevelProjects = (rootName) => {
  const root = path.join(repoRoot, rootName);
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${rootName}/${entry.name}`)
    .filter((directory) => existsSync(path.join(repoRoot, directory, "tsconfig.json")));
};

export const discoverTypecheckProjects = () =>
  [
    ...listOneLevelProjects("apps"),
    ...listOneLevelProjects("games"),
    ...listOneLevelProjects("packages"),
    "content",
    "scripts/repo/visual",
  ]
    .flatMap((directory) => [directory, `${directory}/tests`])
    .filter((directory) => existsSync(path.join(repoRoot, directory, "tsconfig.json")))
    .sort((left, right) => right.length - left.length || left.localeCompare(right));

const findProject = (file, projects) =>
  projects.find((project) => file === project || file.startsWith(`${project}/`));

const affectsProjectTypes = (file) => {
  const extension = path.extname(file);
  const basename = path.basename(file);
  return (
    [".ts", ".tsx", ".mts", ".cts"].includes(extension) ||
    basename === "package.json" ||
    (basename.startsWith("tsconfig") && extension === ".json")
  );
};

export const buildChangedCheckPlan = (
  changedFiles,
  { projects = discoverTypecheckProjects(), fileExists = existsSync } = {},
) => {
  const files = [...new Set(changedFiles.map(normalizePath))].sort();
  const existingFiles = files.filter((file) => fileExists(path.join(repoRoot, file)));
  const lintFiles = existingFiles.filter((file) => lintExtensions.has(path.extname(file)));
  const nodeSyntaxFiles = existingFiles.filter((file) =>
    nodeSyntaxExtensions.has(path.extname(file)),
  );
  const jsonFiles = existingFiles.filter((file) => path.extname(file) === ".json");
  const typedFiles = files.filter(affectsProjectTypes);
  const typecheckProjects = [
    ...new Set(
      typedFiles.map((file) => findProject(file, projects)).filter(Boolean),
    ),
  ].sort();
  const batchReasons = [];

  for (const file of files) {
    if (batchInvalidators.has(file)) {
      batchReasons.push(`central configuration changed: ${file}`);
    }
  }

  if (typecheckProjects.length > fastCheckTargets.maxChangedTypecheckProjects) {
    batchReasons.push(
      `${typecheckProjects.length} TypeScript projects are affected; the fast gate supports at most ${fastCheckTargets.maxChangedTypecheckProjects}`,
    );
  }

  if (files.some((file) => file.startsWith("packages/sdk/src/") && affectsProjectTypes(file))) {
    batchReasons.push(
      "public SDK source changed; consumer compatibility belongs to the batch gate",
    );
  }

  for (const file of existingFiles) {
    if (
      file.startsWith("apps/platform/") &&
      /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) &&
      findProject(file, projects) === "apps/platform"
    ) {
      batchReasons.push(
        `no fast TypeScript project includes the platform test file: ${file}`,
      );
    }
  }

  return {
    changedFiles: files,
    instant: {
      jsonFiles,
      nodeSyntaxFiles,
      targetWarmMs: fastCheckTargets.instantWarmMs,
    },
    changed: {
      lintFiles,
      typecheckProjects,
      targetWarmMs: fastCheckTargets.changedWarmMs,
    },
    batchRequired: batchReasons.length > 0,
    batchReasons,
  };
};
