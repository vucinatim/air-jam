import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyPackageScenario } from "../lib/package-proof.mjs";

test("package proof rejects an unknown scenario before inspecting artifacts", async () => {
  await assert.rejects(
    verifyPackageScenario("/not-a-candidate", "unknown"),
    /Unknown package proof scenario/u,
  );
});

test("package proof rejects missing or escaping archive names before installing", async (context) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "airjam-package-proof-input-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const filename of [undefined, "../outside.tgz", "not-an-archive.json"]) {
    await fs.writeFile(
      path.join(root, "manifest.json"),
      JSON.stringify({ packages: { "@air-jam/sdk": filename } }),
    );
    await assert.rejects(
      verifyPackageScenario(root, "server"),
      /requires a tarball for @air-jam\/sdk/u,
    );
  }
});
