import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {
  deployPreviewRailwayServices,
  recoverPreviewRailwayStagingArtifacts,
} from "../lib/preview-railway.mjs";

test("deployPreviewRailwayServices dry-run describes canonical service deployments", () => {
  const result = deployPreviewRailwayServices({
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
    /would deploy air-jam-server into preview-pr-42/,
  );
});

test("recoverPreviewRailwayStagingArtifacts restores backups from interrupted staging", () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-preview-railway-test-"),
  );
  const baseDir = path.join(tempRoot, "repo");
  const stagingDir = path.join(tempRoot, "staging");
  const stagingStatePath = path.join(stagingDir, "state.json");
  const targetPath = path.join(baseDir, "railway.json");
  const backupRelativePath = path.join("backups", "railway.json");
  const backupPath = path.join(stagingDir, backupRelativePath);

  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });

  fs.writeFileSync(targetPath, '{"stale":true}\n');
  fs.writeFileSync(backupPath, '{"real":true}\n');
  fs.writeFileSync(
    stagingStatePath,
    JSON.stringify({
      entries: [
        {
          targetRelativePath: "railway.json",
          existedBefore: true,
          backupRelativePath,
        },
      ],
    }),
  );

  const recovered = recoverPreviewRailwayStagingArtifacts({
    baseDir,
    stagingDir,
    stagingStatePath,
  });

  assert.equal(recovered, true);
  assert.equal(fs.readFileSync(targetPath, "utf8"), '{"real":true}\n');
  assert.equal(fs.existsSync(stagingDir), false);
});
