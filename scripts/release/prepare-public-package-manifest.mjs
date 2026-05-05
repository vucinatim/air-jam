#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const packageDir = process.cwd();
const packageJsonPath = path.join(packageDir, "package.json");
const backupPath = path.join(packageDir, ".package.json.publish-backup");
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const workspaceProtocolPrefix = "workspace:";

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const loadWorkspacePackages = () => {
  const packagesDir = path.join(repoRoot, "packages");
  const workspacePackages = new Map();

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonFile = path.join(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(packageJsonFile)) continue;
    const packageJson = readJson(packageJsonFile);
    if (typeof packageJson.name !== "string") continue;
    workspacePackages.set(packageJson.name, {
      version: packageJson.version,
      private: packageJson.private === true,
    });
  }

  return workspacePackages;
};

const toPublishedWorkspaceSpec = (workspaceSpec, version) => {
  const token = workspaceSpec.slice(workspaceProtocolPrefix.length);

  if (token === "*" || token.length === 0) {
    return version;
  }

  if (token === "^") {
    return `^${version}`;
  }

  if (token === "~") {
    return `~${version}`;
  }

  if (token.startsWith("^")) {
    return `^${version}`;
  }

  if (token.startsWith("~")) {
    return `~${version}`;
  }

  if (/^\d/.test(token)) {
    return token;
  }

  throw new Error(`Unsupported workspace dependency spec "${workspaceSpec}"`);
};

const main = () => {
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`No package.json found in ${packageDir}`);
  }

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(packageJsonPath, backupPath);
  }

  const packageJson = readJson(packageJsonPath);
  const workspacePackages = loadWorkspacePackages();
  let changed = false;

  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies || typeof dependencies !== "object") {
      continue;
    }

    for (const [dependencyName, dependencySpec] of Object.entries(dependencies)) {
      if (
        typeof dependencySpec !== "string" ||
        !dependencySpec.startsWith(workspaceProtocolPrefix)
      ) {
        continue;
      }

      const workspacePackage = workspacePackages.get(dependencyName);
      if (!workspacePackage) {
        throw new Error(
          `Unable to resolve workspace dependency "${dependencyName}" from ${packageJson.name}`,
        );
      }

      if (workspacePackage.private) {
        delete dependencies[dependencyName];
        changed = true;
        continue;
      }

      const publishedSpec = toPublishedWorkspaceSpec(
        dependencySpec,
        workspacePackage.version,
      );
      if (publishedSpec !== dependencySpec) {
        dependencies[dependencyName] = publishedSpec;
        changed = true;
      }
    }

    if (Object.keys(dependencies).length === 0) {
      delete packageJson[section];
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
};

main();
