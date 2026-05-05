import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const PUBLIC_PACKAGE_DEFINITIONS = [
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

const PUBLIC_PACKAGE_IDS = new Set(
  PUBLIC_PACKAGE_DEFINITIONS.map((pkg) => pkg.id),
);

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

export const resolvePublicPackages = (selection = "all-public") => {
  if (selection === "all-public") {
    return PUBLIC_PACKAGE_DEFINITIONS.map(withResolvedReleaseMetadata);
  }

  if (!PUBLIC_PACKAGE_IDS.has(selection)) {
    throw new Error(
      `Invalid package selection "${selection}". Use one of: all-public, ${Array.from(PUBLIC_PACKAGE_IDS).join(", ")}.`,
    );
  }

  const pkg = PUBLIC_PACKAGE_DEFINITIONS.find(
    (entry) => entry.id === selection,
  );
  if (!pkg) {
    throw new Error(`Unknown public package "${selection}".`);
  }

  return [withResolvedReleaseMetadata(pkg)];
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] ?? "resolve";
  const selection = process.argv[3] ?? "all-public";

  if (command !== "resolve") {
    if (command === "version") {
      process.stdout.write(resolveUnifiedPublicVersion());
      process.exit(0);
    }

    console.error(`Unsupported command "${command}". Use "resolve".`);
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(resolvePublicPackages(selection)));
}
