import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import yazl from "yazl";

import { loadAvailableScaffoldTemplates } from "../src/scaffold";
import {
  extractScaffoldTemplateArchive,
  inspectScaffoldTemplateArchive,
  loadScaffoldArchiveBudgets,
  type ScaffoldArchiveBudgets,
} from "../src/scaffold-archive";

const writeArchive = async (
  archivePath: string,
  entries: Array<{ name: string; contents: Buffer }>,
): Promise<void> => {
  const archive = new yazl.ZipFile();
  const output = fs.createWriteStream(archivePath);
  const closed = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.outputStream.on("error", reject);
  });
  archive.outputStream.pipe(output);
  for (const entry of entries) {
    archive.addBuffer(entry.contents, entry.name);
  }
  archive.end();
  await closed;
};

const withBudgets = (
  overrides: Partial<ScaffoldArchiveBudgets>,
): ScaffoldArchiveBudgets => ({
  ...loadScaffoldArchiveBudgets(),
  ...overrides,
});

test("every packaged scaffold template stays within extraction budgets", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-budget-test-"),
  );
  try {
    for (const template of loadAvailableScaffoldTemplates()) {
      const inspection = await inspectScaffoldTemplateArchive({
        archivePath: template.archivePath,
        targetDir: path.join(tempRoot, template.manifest.id),
      });
      assert.ok(inspection.fileCount > 0);
      assert.ok(inspection.totalUncompressedBytes > 0);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archive inspection rejects excessive entry counts", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-count-test-"),
  );
  try {
    const archivePath = path.join(tempRoot, "count.zip");
    await writeArchive(archivePath, [
      { name: "one.txt", contents: Buffer.from("one") },
      { name: "two.txt", contents: Buffer.from("two") },
      { name: "three.txt", contents: Buffer.from("three") },
    ]);

    await assert.rejects(
      inspectScaffoldTemplateArchive({
        archivePath,
        targetDir: path.join(tempRoot, "target"),
        budgets: withBudgets({ maxEntries: 2 }),
      }),
      /2-entry budget/u,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archive inspection rejects excessive uncompressed bytes", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-size-test-"),
  );
  try {
    const archivePath = path.join(tempRoot, "size.zip");
    await writeArchive(archivePath, [
      { name: "large.bin", contents: crypto.randomBytes(1024) },
    ]);

    await assert.rejects(
      inspectScaffoldTemplateArchive({
        archivePath,
        targetDir: path.join(tempRoot, "target"),
        budgets: withBudgets({
          maxTotalUncompressedBytes: 512,
          maxSingleFileUncompressedBytes: 2048,
        }),
      }),
      /512-byte uncompressed-size budget/u,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("archive inspection rejects excessive compression ratios", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-ratio-test-"),
  );
  try {
    const archivePath = path.join(tempRoot, "ratio.zip");
    await writeArchive(archivePath, [
      { name: "repeated.bin", contents: Buffer.alloc(1024 * 1024) },
    ]);

    await assert.rejects(
      inspectScaffoldTemplateArchive({
        archivePath,
        targetDir: path.join(tempRoot, "target"),
        budgets: withBudgets({ maxCompressionRatio: 2 }),
      }),
      /2:1 compression-ratio budget/u,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("failed extraction removes staging output and never exposes a partial target", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-cleanup-test-"),
  );
  try {
    const archivePath = path.join(tempRoot, "corrupt.zip");
    await writeArchive(archivePath, [
      { name: "payload.bin", contents: crypto.randomBytes(4096) },
    ]);

    const bytes = fs.readFileSync(archivePath);
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    const fileNameLength = bytes.readUInt16LE(26);
    const extraLength = bytes.readUInt16LE(28);
    const compressedDataOffset = 30 + fileNameLength + extraLength;
    bytes[compressedDataOffset] = 0x07;
    fs.writeFileSync(archivePath, bytes);

    const targetDir = path.join(tempRoot, "generated-game");
    await assert.rejects(
      extractScaffoldTemplateArchive({ archivePath, targetDir }),
    );
    assert.equal(fs.existsSync(targetDir), false);
    assert.deepEqual(
      fs
        .readdirSync(tempRoot)
        .filter((entry) =>
          entry.startsWith(".generated-game.airjam-scaffold-"),
        ),
      [],
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("successful extraction publishes the target only after completion", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-scaffold-atomic-test-"),
  );
  try {
    const archivePath = path.join(tempRoot, "valid.zip");
    await writeArchive(archivePath, [
      { name: "nested/ready.txt", contents: Buffer.from("ready\n") },
    ]);

    const targetDir = path.join(tempRoot, "generated-game");
    await extractScaffoldTemplateArchive({ archivePath, targetDir });
    assert.equal(
      fs.readFileSync(path.join(targetDir, "nested", "ready.txt"), "utf8"),
      "ready\n",
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
