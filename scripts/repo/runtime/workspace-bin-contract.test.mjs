import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const packagesToCheck = [
  "packages/server/package.json",
  "packages/mcp-server/package.json",
];

test("workspace package bin entrypoints exist before build", () => {
  for (const relativePackageJsonPath of packagesToCheck) {
    const packageJsonPath = path.join(repoRoot, relativePackageJsonPath);
    const packageDir = path.dirname(packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const binEntries = Object.values(packageJson.bin ?? {});

    assert.ok(binEntries.length > 0, `${relativePackageJsonPath} should declare bins`);

    for (const binPath of binEntries) {
      const absoluteBinPath = path.join(packageDir, binPath);
      assert.ok(
        fs.existsSync(absoluteBinPath),
        `${relativePackageJsonPath} bin target is missing: ${binPath}`,
      );
    }
  }
});

test("workspace bin wrappers execute CLI help without requiring prebuilt dist state", () => {
  const expectations = new Map([
    ["packages/server/package.json", "air-jam-server"],
    ["packages/mcp-server/package.json", "airjam-mcp"],
  ]);

  for (const relativePackageJsonPath of packagesToCheck) {
    const packageJsonPath = path.join(repoRoot, relativePackageJsonPath);
    const packageDir = path.dirname(packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const binEntries = Object.values(packageJson.bin ?? {});

    for (const binPath of binEntries) {
      const absoluteBinPath = path.join(packageDir, binPath);
      const result = spawnSync(process.execPath, [absoluteBinPath, "--help"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NO_COLOR: "1",
          FORCE_COLOR: "0",
        },
      });

      assert.equal(
        result.status,
        0,
        `${relativePackageJsonPath} help invocation failed: ${result.stderr || result.stdout}`,
      );
      assert.match(
        result.stdout,
        new RegExp(expectations.get(relativePackageJsonPath) ?? "", "u"),
        `${relativePackageJsonPath} help output should mention its CLI name`,
      );
    }
  }
});
