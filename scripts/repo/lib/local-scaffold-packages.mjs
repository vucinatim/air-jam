import fs from "node:fs";
import path from "node:path";
import {
  createTarballSetDir,
  packWorkspacePackage,
  writeTarballSetManifest,
} from "./packaging.mjs";
import { repoRoot } from "./paths.mjs";
import { runCommand, runCommandResult } from "./shell.mjs";

const repoPackageDir = (...segments) => path.join(repoRoot, ...segments);
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

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
    packageName: "@air-jam/mcp-server",
    packageDir: repoPackageDir("packages", "mcp-server"),
    directDependency: true,
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
  "@air-jam/sdk",
  "@air-jam/mcp-server",
  "create-airjam",
  "server",
];

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

  console.log("");
  console.log(
    "Refreshing workspace install for local scaffold packaging because some workspace dependency links are missing:",
  );
  for (const pair of missingLinks) {
    console.log(`- ${pair}`);
  }

  const frozenInstall = runCommandResult(
    "pnpm",
    ["install", "--frozen-lockfile"],
    {
      stdio: "pipe",
    },
  );

  if (!frozenInstall.status || frozenInstall.status !== 0) {
    const installOutput = `${frozenInstall.stdout ?? ""}\n${frozenInstall.stderr ?? ""}`;
    if (installOutput.includes("ERR_PNPM_OUTDATED_LOCKFILE")) {
      console.log("");
      console.log(
        "Workspace install refresh detected an outdated pnpm lockfile. Running a normal install to restore local scaffold packaging state.",
      );
      runCommand("pnpm", ["install", "--no-frozen-lockfile"]);
    } else {
      throw new Error(
        `Workspace install refresh failed.\n${installOutput.trim()}`,
      );
    }
  }

  const remainingMissingLinks = localScaffoldPackages.flatMap((entry) =>
    listMissingInstalledWorkspaceLinks(entry.packageDir).map(
      (dependencyName) => `${entry.packageName} -> ${dependencyName}`,
    ),
  );

  if (remainingMissingLinks.length > 0) {
    throw new Error(
      `Workspace install refresh did not restore all local scaffold package links:\n${remainingMissingLinks.join("\n")}`,
    );
  }
};

export const buildLocalScaffoldPackageSet = () => {
  ensureLocalScaffoldWorkspaceInstall();

  for (const filter of localScaffoldBuildFilters) {
    runCommand("pnpm", ["--filter", filter, "build"]);
  }
};

export const packLocalScaffoldPackageSet = () => {
  const { setDir, setId } = createTarballSetDir({
    prefix: "local-scaffold",
  });
  const tarballs = new Map();

  for (const entry of localScaffoldPackages) {
    tarballs.set(
      entry.packageName,
      packWorkspacePackage(entry.packageDir, { outDir: setDir }),
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
