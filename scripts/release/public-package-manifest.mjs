import fs from "node:fs";
import path from "node:path";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const workspaceProtocolPrefix = "workspace:";

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

export const loadWorkspacePackageIndex = (repoRoot) => {
  const packagesDir = path.join(repoRoot, "packages");
  const workspacePackages = new Map();

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    if (typeof manifest.name !== "string") continue;
    workspacePackages.set(manifest.name, {
      version: manifest.version,
      private: manifest.private === true,
      license: manifest.license ?? null,
    });
  }

  return workspacePackages;
};

const toPublishedWorkspaceSpec = (workspaceSpec, version) => {
  const token = workspaceSpec.slice(workspaceProtocolPrefix.length);

  if (token === "*" || token.length === 0) return version;
  if (token === "^" || token.startsWith("^")) return `^${version}`;
  if (token === "~" || token.startsWith("~")) return `~${version}`;
  if (/^\d/u.test(token)) return token;

  throw new Error(`Unsupported workspace dependency spec "${workspaceSpec}"`);
};

export const preparePublicPackageManifest = ({
  manifest,
  workspacePackages,
}) => {
  const prepared = structuredClone(manifest);

  for (const section of dependencySections) {
    const dependencies = prepared[section];
    if (!dependencies || typeof dependencies !== "object") continue;

    for (const [dependencyName, dependencySpec] of Object.entries(
      dependencies,
    )) {
      if (
        typeof dependencySpec !== "string" ||
        !dependencySpec.startsWith(workspaceProtocolPrefix)
      ) {
        continue;
      }

      const workspacePackage = workspacePackages.get(dependencyName);
      if (!workspacePackage) {
        throw new Error(
          `Unable to resolve workspace dependency "${dependencyName}" from ${prepared.name}`,
        );
      }
      if (workspacePackage.private) {
        delete dependencies[dependencyName];
        continue;
      }
      dependencies[dependencyName] = toPublishedWorkspaceSpec(
        dependencySpec,
        workspacePackage.version,
      );
    }

    if (Object.keys(dependencies).length === 0) delete prepared[section];
  }

  return prepared;
};

export const preparePublicPackageManifestFile = ({ repoRoot, packageDir }) => {
  const manifestPath = path.join(packageDir, "package.json");
  const manifest = readJson(manifestPath);
  return preparePublicPackageManifest({
    manifest,
    workspacePackages: loadWorkspacePackageIndex(repoRoot),
  });
};
