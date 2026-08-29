import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parse as parseYaml } from "yaml";

import { repoRoot } from "../lib/paths.mjs";

const workspaceConfigPath = path.join(repoRoot, "pnpm-workspace.yaml");
const dependencyStageDockerfiles = [
  "apps/platform/Dockerfile",
  "packages/server/Dockerfile",
];

const readWorkspaceManifestPaths = () => {
  const config = parseYaml(fs.readFileSync(workspaceConfigPath, "utf8"));
  const patterns = config?.packages;
  assert.ok(Array.isArray(patterns), "pnpm-workspace.yaml must list packages");

  const excludedRoots = new Set(
    patterns
      .filter((pattern) => pattern.startsWith("!"))
      .map((pattern) => pattern.slice(1)),
  );
  const manifests = [];

  for (const pattern of patterns.filter((entry) => !entry.startsWith("!"))) {
    assert.match(
      pattern,
      /^[^*]+\/\*$/u,
      `Docker manifest validation does not understand workspace pattern ${pattern}`,
    );
    const parent = pattern.slice(0, -2);
    const parentPath = path.join(repoRoot, parent);
    for (const entry of fs.readdirSync(parentPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const workspaceRoot = `${parent}/${entry.name}`;
      if (excludedRoots.has(workspaceRoot)) continue;
      const manifest = `${workspaceRoot}/package.json`;
      if (fs.existsSync(path.join(repoRoot, manifest)))
        manifests.push(manifest);
    }
  }

  return manifests.sort();
};

test("dependency-stage Dockerfiles copy every pnpm workspace manifest", () => {
  const workspaceManifests = readWorkspaceManifestPaths();

  for (const dockerfilePath of dependencyStageDockerfiles) {
    const dockerfile = fs.readFileSync(
      path.join(repoRoot, dockerfilePath),
      "utf8",
    );
    const missing = workspaceManifests.filter(
      (manifest) =>
        !new RegExp(
          `^COPY\\s+${manifest.replaceAll("/", "\\/")}\\s+`,
          "mu",
        ).test(dockerfile),
    );

    assert.deepEqual(
      missing,
      [],
      `${dockerfilePath} would hide workspace dependencies from pnpm install`,
    );
  }
});
