import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));

test("public package ownership has one canonical project CLI", () => {
  const cli = readJson("packages/cli/package.json");
  const createAirJam = readJson("packages/create-airjam/package.json");
  const server = readJson("packages/server/package.json");

  assert.deepEqual(cli.bin, { airjam: "./dist/index.js" });
  assert.deepEqual(Object.keys(cli.exports).sort(), [
    "./scaffold",
    "./vite-config",
  ]);
  assert.ok(cli.files.includes("template-assets"));

  assert.deepEqual(createAirJam.bin, {
    "create-airjam": "./dist/index.js",
  });
  assert.ok(createAirJam.dependencies["@air-jam/cli"]);
  assert.ok(!createAirJam.files.includes("runtime"));
  assert.ok(!createAirJam.files.includes("template-assets"));

  assert.deepEqual(server.bin, {
    "air-jam-server": "./bin/air-jam-server.mjs",
  });
  assert.equal(server.exports, undefined);
  assert.equal(server.main, undefined);
  assert.equal(server.module, undefined);
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
