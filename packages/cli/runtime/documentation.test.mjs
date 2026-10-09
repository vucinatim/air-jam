import { readDocumentationSnapshot } from "@air-jam/cli/documentation";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

test("the public snapshot owns every creator page without private imports", async () => {
  const snapshot = await readDocumentationSnapshot();
  const catalog = JSON.parse(
    await fs.readFile(
      new URL("../../../content/docs/catalog.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(snapshot.documents.length, 16);
  assert.deepEqual(
    snapshot.documents.map((entry) => entry.page),
    catalog.map((entry) => entry.page),
  );
  for (const document of snapshot.documents) {
    assert.equal(
      document.content,
      await fs.readFile(
        new URL(`../../../content/docs/${document.source}`, import.meta.url),
        "utf8",
      ),
    );
    let inCodeFence = false;
    for (const line of document.content.split("\n")) {
      if (line.trim().startsWith("```")) inCodeFence = !inCodeFence;
      if (!inCodeFence) assert.doesNotMatch(line, /^(?:import |export )/);
    }
  }
});

test("documentation discovery and reads have clean JSON output", async () => {
  const list = await execute(process.execPath, [
    path.join(packageRoot, "bin/airjam.mjs"),
    "docs",
    "list",
    "--json",
  ]);
  assert.equal(JSON.parse(list.stdout).documents.length, 16);
  const read = await execute(process.execPath, [
    path.join(packageRoot, "bin/airjam.mjs"),
    "docs",
    "read",
    "sdk/ui-components",
    "--json",
  ]);
  assert.equal(JSON.parse(read.stdout).document.page.title, "UI Components");
  assert.match(JSON.parse(read.stdout).document.content, /@air-jam\/sdk\/ui/);
});

test("a packaged consumer fails on tampered bytes and unsafe identities", async () => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "airjam-documentation-consumer-"),
  );
  try {
    await fs.cp(path.join(packageRoot, "dist"), path.join(root, "dist"), {
      recursive: true,
    });
    await fs.cp(
      path.join(packageRoot, "template-assets/documentation"),
      path.join(root, "template-assets/documentation"),
      { recursive: true },
    );
    await fs.symlink(
      path.join(packageRoot, "node_modules"),
      path.join(root, "node_modules"),
      "dir",
    );
    const { readDocumentationSnapshot: readSnapshot } = await import(
      pathToFileURL(path.join(root, "dist/documentation.js"))
    );
    const initial = await readSnapshot();
    assert.equal(initial.documents.length, 16);
    const first = initial.documents[0];
    const sourcePath = path.join(
      root,
      "template-assets/documentation",
      first.source,
    );
    await fs.appendFile(sourcePath, "tampered");
    await assert.rejects(readSnapshot(), /Documentation integrity failed/);
    await fs.writeFile(sourcePath, first.content);
    const manifestPath = path.join(
      root,
      "template-assets/documentation/manifest.json",
    );
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.documents[0].source = "../../outside/page.mdx";
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(readSnapshot(), /Invalid/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
