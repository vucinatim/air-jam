import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const PUBLIC_PACKAGE_DEFINITIONS = [
  {
    id: "sdk",
    packageName: "@air-jam/sdk",
    packageFilter: "@air-jam/sdk",
    workingDirectory: "packages/sdk",
    tagPrefix: "sdk",
  },
  {
    id: "mcp-server",
    packageName: "@air-jam/mcp-server",
    packageFilter: "@air-jam/mcp-server",
    workingDirectory: "packages/mcp-server",
    tagPrefix: "mcp-server",
  },
  {
    id: "cli",
    packageName: "@air-jam/cli",
    packageFilter: "@air-jam/cli",
    workingDirectory: "packages/cli",
    tagPrefix: "cli",
  },
  {
    id: "server",
    packageName: "@air-jam/server",
    packageFilter: "@air-jam/server",
    workingDirectory: "packages/server",
    tagPrefix: "server",
  },
  {
    id: "create-airjam",
    packageName: "create-airjam",
    packageFilter: "create-airjam",
    workingDirectory: "packages/create-airjam",
    tagPrefix: "create-airjam",
  },
];

const readVersion = (workingDirectory) => {
  const packageJsonPath = path.join(rootDir, workingDirectory, "package.json");
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")).version;
};

const withResolvedReleaseMetadata = (pkg) => {
  const version = readVersion(pkg.workingDirectory);
  return {
    ...pkg,
    version,
    tag: `${pkg.tagPrefix}-v${version}`,
    releaseName: `${pkg.packageName} v${version}`,
  };
};

export const resolveUnifiedPublicVersion = () => {
  const versions = new Set(
    PUBLIC_PACKAGE_DEFINITIONS.map((pkg) => readVersion(pkg.workingDirectory)),
  );

  if (versions.size !== 1) {
    throw new Error(
      `Public package versions are not unified: ${Array.from(versions).join(", ")}`,
    );
  }

  return Array.from(versions)[0];
};

export const resolvePublicPackages = () =>
  PUBLIC_PACKAGE_DEFINITIONS.map(withResolvedReleaseMetadata);

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const command = process.argv[2] ?? "resolve";

  if (command !== "resolve") {
    if (command === "version") {
      process.stdout.write(resolveUnifiedPublicVersion());
      process.exit(0);
    }

    console.error(`Unsupported command "${command}". Use "resolve".`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(resolvePublicPackages()));
}
