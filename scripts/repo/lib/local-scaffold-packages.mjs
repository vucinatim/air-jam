import fs from "node:fs";
import path from "node:path";
import { PUBLIC_PACKAGE_DEFINITIONS } from "../../release/public-packages.mjs";
import {
  createTarballSetDir,
  packWorkspacePackage,
  writeTarballSetManifest,
} from "./packaging.mjs";
import { repoRoot } from "./paths.mjs";
import { runCommand } from "./shell.mjs";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

export const localScaffoldPackages = PUBLIC_PACKAGE_DEFINITIONS.map(
  (entry) => ({
    packageName: entry.packageName,
    packageDir: path.join(repoRoot, entry.workingDirectory),
    directDependency: entry.scaffoldDependency,
  }),
);

const localScaffoldPackageByName = new Map(
  localScaffoldPackages.map((entry) => [entry.packageName, entry]),
);

const exactVersion = (value) =>
  typeof value === "string" ? value.replace(/^[~^]/, "") : null;

const readPackageJson = (packageDir) =>
  JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));

const resolveInstalledWorkspacePackageJsonPath = (packageDir, packageName) =>
  path.join(
    packageDir,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );

const listMissingInstalledWorkspaceLinks = (packageDir) => {
  const packageJson = readPackageJson(packageDir);
  const missing = new Set();

  for (const section of dependencySections) {
    for (const [dependencyName, dependencySpec] of Object.entries(
      packageJson[section] ?? {},
    )) {
      if (
        typeof dependencySpec !== "string" ||
        !dependencySpec.startsWith("workspace:")
      ) {
        continue;
      }

      if (!localScaffoldPackageByName.has(dependencyName)) {
        continue;
      }

      if (
        !fs.existsSync(
          resolveInstalledWorkspacePackageJsonPath(packageDir, dependencyName),
        )
      ) {
        missing.add(dependencyName);
      }
    }
  }

  return [...missing];
};

export const ensureLocalScaffoldWorkspaceInstall = () => {
  const missingLinks = localScaffoldPackages.flatMap((entry) =>
    listMissingInstalledWorkspaceLinks(entry.packageDir).map(
      (dependencyName) => `${entry.packageName} -> ${dependencyName}`,
    ),
  );

  if (missingLinks.length === 0) {
    return;
  }

  throw new Error(
    `Missing workspace dependency links:\n${missingLinks.join("\n")}\nRun pnpm install --frozen-lockfile before packaging.`,
  );
};

export const buildLocalScaffoldPackageSet = ({ stdio = "inherit" } = {}) => {
  ensureLocalScaffoldWorkspaceInstall();

  for (const entry of PUBLIC_PACKAGE_DEFINITIONS) {
    if (
      readPackageJson(path.join(repoRoot, entry.workingDirectory)).scripts
        ?.build
    ) {
      runCommand("pnpm", ["--filter", entry.packageFilter, "build"], { stdio });
    }
  }
};

export const packLocalScaffoldPackageSet = ({ stdio = "inherit" } = {}) => {
  const { setDir, setId } = createTarballSetDir({
    prefix: "local-scaffold",
  });
  const tarballs = new Map();

  for (const entry of localScaffoldPackages) {
    tarballs.set(
      entry.packageName,
      packWorkspacePackage(entry.packageDir, { outDir: setDir, stdio }),
    );
  }

  const manifestPath = writeTarballSetManifest({
    setDir,
    setId,
    tarballs,
  });

  return {
    manifestPath,
    setDir,
    setId,
    tarballs,
  };
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
