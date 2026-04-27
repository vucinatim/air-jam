import fs from "node:fs";
import path from "node:path";
import { packWorkspacePackage } from "./packaging.mjs";
import { repoRoot } from "./paths.mjs";
import { runCommand } from "./shell.mjs";

const repoPackageDir = (...segments) => path.join(repoRoot, ...segments);

export const localScaffoldPackages = [
  {
    packageName: "@air-jam/sdk",
    packageDir: repoPackageDir("packages", "sdk"),
    directDependency: true,
  },
  {
    packageName: "@air-jam/server",
    packageDir: repoPackageDir("packages", "server"),
    directDependency: true,
  },
  {
    packageName: "@air-jam/harness",
    packageDir: repoPackageDir("packages", "harness"),
    directDependency: true,
  },
  {
    packageName: "@air-jam/mcp-server",
    packageDir: repoPackageDir("packages", "mcp-server"),
    directDependency: true,
  },
  {
    packageName: "@air-jam/devtools-core",
    packageDir: repoPackageDir("packages", "devtools-core"),
    directDependency: false,
  },
  {
    packageName: "@air-jam/env",
    packageDir: repoPackageDir("packages", "env"),
    directDependency: false,
  },
  {
    packageName: "@air-jam/runtime-topology",
    packageDir: repoPackageDir("packages", "runtime-topology"),
    directDependency: false,
  },
  {
    packageName: "create-airjam",
    packageDir: repoPackageDir("packages", "create-airjam"),
    directDependency: true,
  },
];

const localScaffoldPackageByName = new Map(
  localScaffoldPackages.map((entry) => [entry.packageName, entry]),
);

const localScaffoldBuildFilters = [
  "create-airjam",
  "server",
  "@air-jam/harness",
];

const exactVersion = (value) =>
  typeof value === "string" ? value.replace(/^[~^]/, "") : null;

export const buildLocalScaffoldPackageSet = () => {
  for (const filter of localScaffoldBuildFilters) {
    runCommand("pnpm", ["--filter", filter, "build"]);
  }
};

export const packLocalScaffoldPackageSet = () => {
  const tarballs = new Map();

  for (const entry of localScaffoldPackages) {
    tarballs.set(entry.packageName, packWorkspacePackage(entry.packageDir));
  }

  return tarballs;
};

export const resolveLocalScaffoldWorkspaceSpecs = () =>
  new Map(
    localScaffoldPackages.map((entry) => [
      entry.packageName,
      `link:${entry.packageDir}`,
    ]),
  );

export const listLocalScaffoldDirectDependencyNames = () =>
  localScaffoldPackages
    .filter((entry) => entry.directDependency)
    .map((entry) => entry.packageName);

export const listLocalScaffoldOverrideDependencyNames = () =>
  localScaffoldPackages
    .filter((entry) => entry.packageName !== "create-airjam")
    .map((entry) => entry.packageName);

export const getLocalScaffoldPackageDir = (packageName) => {
  const entry = localScaffoldPackageByName.get(packageName);
  if (!entry) {
    throw new Error(`Unknown local scaffold package "${packageName}"`);
  }
  return entry.packageDir;
};

export const getLocalScaffoldExactZodVersion = () => {
  const sdkPackageJson = JSON.parse(
    fs.readFileSync(
      path.join(getLocalScaffoldPackageDir("@air-jam/sdk"), "package.json"),
      "utf8",
    ),
  );
  return exactVersion(sdkPackageJson.dependencies?.zod);
};
