import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { resolvePublicPackages } from "../../release/public-packages.mjs";
import {
  listLocalScaffoldDirectDependencyNames,
  localScaffoldPackages,
} from "../lib/local-scaffold-packages.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

test("MCP typechecking builds its own distribution before checking consumer tests", () => {
  const manifest = readJson("packages/mcp-server/package.json");
  assert.match(
    manifest.scripts.typecheck,
    /^node \.\.\/\.\.\/scripts\/ensure-workspace-package-build\.mjs @air-jam\/mcp-server &&/u,
  );
  assert.ok(
    manifest.scripts.typecheck.endsWith("tsc -p tests/tsconfig.json --noEmit"),
  );
});

test("the public workspace owns only the framework and reference games", () => {
  for (const relativePath of [
    "apps/platform/package.json",
    "packages/database-contract/package.json",
    "packages/network-policy/package.json",
    "packages/operations-contract/package.json",
    "docker-compose.dev.yml",
    "scripts/repo/commands/platform.mjs",
    "scripts/repo/commands/db.mjs",
    "scripts/repo/commands/railway.mjs",
    "scripts/repo/commands/readiness.mjs",
  ]) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, relativePath)),
      false,
      relativePath,
    );
  }
  const publicPackages = new Set(
    resolvePublicPackages().map((entry) => entry.packageName),
  );
  for (const directory of fs.readdirSync(path.join(repoRoot, "packages"))) {
    const manifestPath = path.join("packages", directory, "package.json");
    if (!fs.existsSync(path.join(repoRoot, manifestPath))) continue;
    const manifest = readJson(manifestPath);
    assert.ok(publicPackages.has(manifest.name), manifestPath);
    for (const section of [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
    ]) {
      for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
        if (specifier.startsWith("workspace:"))
          assert.ok(publicPackages.has(name), `${manifest.name} -> ${name}`);
      }
    }
  }
  const source = fs.readFileSync(
    path.join(repoRoot, "scripts/repo/cli.mjs"),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /register(?:Platform|Db|Railway|Readiness|Smoke|Content)Commands/u,
  );
});

test("local package qualification is discoverable with structured evidence", () => {
  const help = execFileSync(
    process.execPath,
    ["scripts/repo/cli.mjs", "pack", "verify-local", "--help"],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );
  assert.match(help, /--json/u);
  assert.match(help, /exact local foundation package set/u);
});

test("public package ownership has one canonical project CLI", () => {
  const cli = readJson("packages/cli/package.json");
  const createAirJam = readJson("packages/create-airjam/package.json");
  const server = readJson("packages/server/package.json");

  assert.deepEqual(cli.bin, { airjam: "./bin/airjam.mjs" });
  assert.deepEqual(Object.keys(cli.exports).sort(), [
    "./ai-pack",
    "./development",
    "./documentation",
    "./scaffold",
    "./vite-config",
  ]);
  assert.ok(cli.files.includes("template-assets"));
  assert.ok(cli.files.includes("runtime/local-network.mjs"));

  assert.deepEqual(createAirJam.bin, {
    "create-airjam": "./dist/index.js",
  });
  assert.ok(createAirJam.dependencies["@air-jam/cli"]);
  assert.ok(!createAirJam.files.includes("runtime"));
  assert.ok(!createAirJam.files.includes("template-assets"));

  assert.deepEqual(server.bin, {
    "air-jam-server": "./bin/air-jam-server.mjs",
  });
  assert.deepEqual(server.exports, {
    ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
  });
  assert.equal(server.main, undefined);
  assert.equal(server.module, undefined);
});

test("shipped CLI runtime modules close over shipped relative imports", () => {
  const cli = readJson("packages/cli/package.json");
  const shippedFiles = new Set(cli.files);
  const runtimeEntries = [...shippedFiles].filter(
    (entry) => entry.startsWith("runtime/") && entry.endsWith(".mjs"),
  );

  for (const entry of runtimeEntries) {
    const source = fs.readFileSync(
      path.join(repoRoot, "packages/cli", entry),
      "utf8",
    );
    for (const match of source.matchAll(/\bfrom\s+["'](\.\/[^"']+)["']/gu)) {
      const importedPath = path.posix.normalize(
        path.posix.join(path.posix.dirname(entry), match[1]),
      );
      assert.ok(
        shippedFiles.has(importedPath),
        `${entry} imports ${importedPath}, but the CLI package does not ship it`,
      );
    }
  }
});

test("obsolete project CLI implementations are fully removed", () => {
  for (const relativePath of [
    "packages/create-airjam/template-assets",
    "packages/server/src/project-cli",
    "packages/create-airjam/runtime/game-dev.mjs",
    "packages/create-airjam/runtime/runtime-env.mjs",
    "packages/create-airjam/runtime/topology.mjs",
    "packages/create-airjam/runtime/vite-config.mjs",
  ]) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, relativePath)),
      false,
      `${relativePath} must not survive the ownership cut`,
    );
  }
});

test("raw SDK runtimes are isolated behind explicit expert subpaths", () => {
  const sdk = readJson("packages/sdk/package.json");
  const rootSource = fs.readFileSync(
    path.join(repoRoot, "packages/sdk/src/index.ts"),
    "utf8",
  );

  assert.ok(sdk.exports["./arcade/runtime"]);
  assert.ok(sdk.exports["./runtime-inspection"]);
  assert.doesNotMatch(rootSource, /host-runtime|controller-runtime/u);
  assert.doesNotMatch(rootSource, /arcade\/runtime/u);
  assert.doesNotMatch(rootSource, /runtime-inspection/u);
});

test("the canonical CLI participates in the public release set", () => {
  const releaseSource = fs.readFileSync(
    path.join(repoRoot, "scripts/release/public-packages.mjs"),
    "utf8",
  );
  assert.match(releaseSource, /packages\/cli/u);
});

test("public agent hosts share one canonical devtools-helper build", () => {
  for (const packagePath of [
    "packages/cli/package.json",
    "packages/mcp-server/package.json",
  ]) {
    const manifest = readJson(packagePath);
    assert.match(
      manifest.scripts.build,
      /scripts\/build-devtools-helpers\.mjs --out-dir dist\/tooling/u,
    );
    assert.ok(manifest.files.includes("dist"));
  }
  assert.equal(
    fs.existsSync(path.join(repoRoot, "packages/cli/tsup.tooling.config.ts")),
    false,
  );
});

test("the local candidate package set matches the public release graph", () => {
  assert.deepEqual(
    localScaffoldPackages.map((entry) => entry.packageName).sort(),
    resolvePublicPackages()
      .map((entry) => entry.packageName)
      .sort(),
  );
});

test("optional library packages do not become scaffold root dependencies", () => {
  assert.deepEqual(listLocalScaffoldDirectDependencyNames().sort(), [
    "@air-jam/cli",
    "@air-jam/mcp-server",
    "@air-jam/sdk",
    "@air-jam/server",
    "create-airjam",
  ]);
  for (const packageDirectory of ["env", "harness", "devtools-core"]) {
    const manifest = readJson(`packages/${packageDirectory}/package.json`);
    assert.equal(manifest.private, false);
    assert.equal(manifest.version, resolvePublicPackages()[0].version);
    assert.ok(manifest.exports["."]);
    assert.ok(manifest.scripts.prepack);
  }
});

test("the public server has no hosted product dependency or database implementation", () => {
  const server = readJson("packages/server/package.json");
  for (const dependency of [
    "@air-jam/database-contract",
    "@air-jam/operations-contract",
    "postgres",
    "drizzle-orm",
  ]) {
    assert.equal(server.dependencies?.[dependency], undefined);
    assert.equal(server.devDependencies?.[dependency], undefined);
  }
  const sourceRoot = path.join(repoRoot, "packages/server/src");
  const files = fs.readdirSync(sourceRoot, { recursive: true });
  for (const file of files.filter((file) => file.endsWith(".ts"))) {
    const source = fs.readFileSync(path.join(sourceRoot, file), "utf8");
    assert.doesNotMatch(
      source,
      /@air-jam\/(?:database|operations)-contract|from ["'](?:postgres|drizzle-orm)/u,
      file,
    );
  }
  assert.equal(fs.existsSync(path.join(sourceRoot, "db.ts")), false);
});

test("the canonical AI pack manifest is committed with the CLI assets", () => {
  const manifestPath =
    "packages/cli/template-assets/managed/.airjam/ai-pack.json";
  const trackedFiles = execFileSync(
    "git",
    ["ls-files", "--error-unmatch", manifestPath],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(trackedFiles.trim(), manifestPath);
  const manifest = readJson(manifestPath);
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.packVersion, "0.1.0");
  assert.deepEqual(manifest.source, {
    mode: "packaged-snapshot",
    package: "@air-jam/cli",
  });
  assert.equal(manifest.update, undefined);
  assert.ok(manifest.managedFiles.length > 0);
  assert.match(manifest.contentDigest, /^[a-f0-9]{64}$/u);
});
