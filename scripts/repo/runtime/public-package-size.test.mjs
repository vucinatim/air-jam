import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { repoRoot } from "../lib/paths.mjs";
import { enforcePublicPackageBudgets } from "../lib/public-release-candidate.mjs";

const { budgets } = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "scripts/repo/programs/public-install-matrix.json"),
    "utf8",
  ),
);
const packages = Object.entries(budgets.tarballBytes).map(([name, bytes]) => ({
  name,
  bytes,
}));

test("candidate archives accept the exact size limits and reject one byte over", () => {
  const result = enforcePublicPackageBudgets({ packages, budgets });
  assert.ok(result.packages.every((entry) => entry.remainingBytes === 0));
  const oversized = packages.map((entry) => ({
    ...entry,
    bytes: entry.bytes + Number(entry.name === "@air-jam/sdk"),
  }));
  assert.throws(
    () => enforcePublicPackageBudgets({ packages: oversized, budgets }),
    /@air-jam\/sdk tarball is 2097153 bytes; budget is 2097152 bytes/u,
  );
  const total = packages.reduce((sum, entry) => sum + entry.bytes, 0);
  assert.throws(
    () =>
      enforcePublicPackageBudgets({
        packages,
        budgets: { ...budgets, totalTarballBytes: total - 1 },
      }),
    /Public package graph is .* bytes; budget is .* bytes/u,
  );
});

test("size qualification requires every package exactly once", () => {
  for (const incomplete of [
    packages.slice(1),
    [...packages, packages[0]],
    [...packages.slice(1), { name: "unexpected", bytes: 1 }],
  ]) {
    assert.throws(
      () => enforcePublicPackageBudgets({ packages: incomplete, budgets }),
      /exact public package graph/u,
    );
  }
});

test("SDK maps resolve to shipped sources without embedding duplicate source text", () => {
  const sdkRoot = path.join(repoRoot, "packages/sdk");
  const distributionRoot = path.join(sdkRoot, "dist");
  const maps = fs
    .readdirSync(distributionRoot, { recursive: true })
    .filter((file) => file.endsWith(".map"));
  assert.ok(maps.length > 0);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(sdkRoot, "package.json")),
  );
  assert.ok(manifest.files.includes("src"));
  for (const file of maps) {
    const mapPath = path.join(distributionRoot, file);
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    assert.equal(map.sourcesContent, undefined, file);
    for (const source of map.sources) {
      const sourcePath = path.resolve(path.dirname(mapPath), source);
      assert.ok(
        sourcePath.startsWith(path.join(sdkRoot, "src") + path.sep),
        source,
      );
      assert.ok(fs.statSync(sourcePath).isFile(), source);
    }
  }
  for (const entry of Object.values(manifest.exports)) {
    for (const target of typeof entry === "string"
      ? [entry]
      : Object.values(entry)) {
      assert.ok(fs.statSync(path.join(sdkRoot, target)).isFile(), target);
    }
  }
});
