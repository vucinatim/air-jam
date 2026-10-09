import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import test from "node:test";

import { readAiPackSnapshot } from "@air-jam/cli/ai-pack";

test("the supported AI pack entrypoint returns the verified packaged bytes", async () => {
  const { manifest, contents } = await readAiPackSnapshot();
  const packagedManifest = JSON.parse(
    await fs.readFile(
      new URL(
        "../template-assets/managed/.airjam/ai-pack.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(manifest, packagedManifest);
  assert.equal(contents.size, manifest.managedFiles.length);
  for (const file of manifest.managedFiles) {
    const content = contents.get(file.path);
    assert.ok(Buffer.isBuffer(content), file.path);
    assert.equal(content.byteLength, file.size);
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      file.sha256,
    );
    assert.deepEqual(
      content,
      await fs.readFile(
        new URL(`../template-assets/managed/${file.path}`, import.meta.url),
      ),
    );
  }
});
