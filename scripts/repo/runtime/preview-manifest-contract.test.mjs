import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewManifest } from "../lib/preview-manifest.mjs";

test("createPreviewManifest returns stable per-pr names and prefixes", () => {
  const manifest = createPreviewManifest({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    previewBaseDomain: "preview.airjam.io",
  });

  assert.equal(manifest.previewId, "pr-42");
  assert.equal(manifest.git.branchSlug, "codex-preview-system");
  assert.equal(manifest.git.commitShortSha, "abcdef123456");
  assert.equal(manifest.vercel.deployTag, "pr-42-abcdef123456");
  assert.equal(manifest.vercel.previewHost, "pr-42.preview.airjam.io");
  assert.equal(manifest.railway.sourceEnvironmentName, "production");
  assert.equal(manifest.railway.environmentName, "preview-pr-42");
  assert.equal(manifest.database.branchName, "pr-42");
  assert.equal(manifest.database.schemaName, "preview_pr_42");
  assert.equal(manifest.storage.prefix, "pr/42/");
});

test("createPreviewManifest rejects invalid pull request numbers", () => {
  assert.throws(
    () => createPreviewManifest({ prNumber: 0 }),
    /positive integer/,
  );
});
