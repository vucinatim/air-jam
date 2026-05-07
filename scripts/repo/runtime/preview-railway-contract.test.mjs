import assert from "node:assert/strict";
import test from "node:test";
import { deployPreviewRailwayServices } from "../lib/preview-railway.mjs";

test("deployPreviewRailwayServices dry-run describes commit-based native Railway deployments", async () => {
  const result = await deployPreviewRailwayServices({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    previewBaseDomain: "preview.airjam.io",
    apply: false,
  });

  assert.equal(result.environmentName, "preview-pr-42");
  assert.deepEqual(result.serviceNames, [
    "air-jam-server",
    "air-jam-release-browser-worker",
  ]);
  assert.match(
    result.actions[0],
    /would deploy air-jam-server into preview-pr-42 from commit abcdef1234567890/,
  );
});
