import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const workflowFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/publish-packages.yml",
];
const lockfileSource = fs.readFileSync(
  path.join(repoRoot, "pnpm-lock.yaml"),
  "utf8",
);

test("repo declares pnpm through packageManager", () => {
  assert.match(rootPackageJson.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
});

test("packageManager major matches the lockfile format major", () => {
  const packageManagerMajor = Number(
    rootPackageJson.packageManager.match(/^pnpm@(\d+)\./u)?.[1],
  );
  const lockfileMajor = Number(
    lockfileSource.match(/^lockfileVersion:\s*'?(\d+)(?:\.\d+)?'?/mu)?.[1],
  );

  assert.ok(
    Number.isInteger(packageManagerMajor),
    "packageManager should declare a pnpm major version",
  );
  assert.ok(
    Number.isInteger(lockfileMajor),
    "pnpm-lock.yaml should declare a lockfile major version",
  );
  assert.equal(
    packageManagerMajor,
    lockfileMajor,
    "packageManager pnpm major should match pnpm-lock.yaml lockfile major",
  );
});

test("workflows use corepack-driven pnpm instead of hardcoded setup versions", () => {
  for (const relativePath of workflowFiles) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    assert.ok(
      source.includes("corepack enable"),
      `${relativePath} should enable corepack`,
    );
    assert.ok(
      !source.includes("pnpm/action-setup"),
      `${relativePath} should not hardcode pnpm via pnpm/action-setup`,
    );
    assert.ok(
      !/corepack prepare pnpm@/u.test(source),
      `${relativePath} should not pin pnpm separately from packageManager`,
    );
  }
});
