import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  aiPackManifestRelativePath,
  generateAiPackBuildManifest,
  readVerifiedAiPackSnapshot,
} from "../../../packages/cli/scripts/ai-pack-contract.mjs";

const createPack = async (context) => {
  const rootDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "airjam-pack-generation-"),
  );
  context.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  const manifestPath = path.join(rootDir, aiPackManifestRelativePath);
  const docPath = path.join(rootDir, "docs/airjam/generated/quick-start.md");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir(path.dirname(docPath), { recursive: true });
  const metadata = {
    packVersion: "1.0.0",
    channel: "stable",
    releaseDate: "2026-09-11",
    scaffold: { template: null, createAirjamVersion: null },
  };
  await fs.writeFile(manifestPath, JSON.stringify(metadata));
  await fs.writeFile(docPath, "Original documentation.\n");
  return { rootDir, manifestPath, docPath, metadata };
};

test("regenerating the manifest makes changed base docs a verifiable snapshot", async (context) => {
  const { rootDir, docPath, metadata } = await createPack(context);
  const first = await generateAiPackBuildManifest({ rootDir });
  await readVerifiedAiPackSnapshot(rootDir);
  await fs.writeFile(
    docPath,
    "Changed public quick start and agent instructions.\n",
  );
  await assert.rejects(
    readVerifiedAiPackSnapshot(rootDir),
    /managedFiles do not match/,
  );

  const regenerated = await generateAiPackBuildManifest({ rootDir });
  const verified = await readVerifiedAiPackSnapshot(rootDir);
  assert.deepEqual(verified.manifest, regenerated);
  assert.notEqual(regenerated.contentDigest, first.contentDigest);
  for (const key of Object.keys(metadata))
    assert.deepEqual(regenerated[key], metadata[key]);
  assert.deepEqual(await generateAiPackBuildManifest({ rootDir }), regenerated);
});

test("manifest generation still rejects invalid release metadata", async (context) => {
  const { rootDir, manifestPath, metadata } = await createPack(context);
  await fs.writeFile(
    manifestPath,
    JSON.stringify({ ...metadata, channel: "untrusted" }),
  );
  await assert.rejects(
    generateAiPackBuildManifest({ rootDir }),
    /channel must be stable or canary/,
  );
});

test("manifest generation does not make unmanaged paths valid", async (context) => {
  const { rootDir } = await createPack(context);
  await fs.writeFile(
    path.join(rootDir, "unexpected.txt"),
    "not framework guidance",
  );
  await assert.rejects(
    generateAiPackBuildManifest({ rootDir }),
    /managed path is outside docs\/airjam/,
  );
});
