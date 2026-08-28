import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readRepoSource = (path) =>
  readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("creator transports expose semantic lifecycle operations only", async () => {
  const [releaseRouter, mediaRouter] = await Promise.all([
    readRepoSource("apps/platform/src/server/api/routers/release.ts"),
    readRepoSource("apps/platform/src/server/api/routers/game-media.ts"),
  ]);

  assert.doesNotMatch(releaseRouter, /\bupdateStatus\s*:/u);
  assert.doesNotMatch(mediaRouter, /\bupdateStatus\s*:/u);

  for (const operation of ["finalizeUpload", "publish", "archive"]) {
    assert.match(releaseRouter, new RegExp(`\\b${operation}\\s*:`));
  }

  for (const operation of ["finalizeUpload", "assignAsset", "archiveAsset"]) {
    assert.match(mediaRouter, new RegExp(`\\b${operation}\\s*:`));
  }
});
