import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { writeTemplateArchive } from "../scripts/lib/template-archive.mjs";

const readFile = (filePath) => fs.readFileSync(filePath);

test("create-airjam reports the installed package version", () => {
  const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const output = execFileSync(
    process.execPath,
    [path.join(packageRoot, "dist/index.js"), "--version"],
    { cwd: packageRoot, encoding: "utf8" },
  );
  assert.equal(output.trim(), "0.9.2");
});

test("template archives are deterministic across source timestamp changes", async () => {
  const tempRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "airjam-template-archive-test-"),
  );

  try {
    const sourceDir = path.join(tempRoot, "source");
    fs.mkdirSync(path.join(sourceDir, "nested"), { recursive: true });

    const shellScriptPath = path.join(sourceDir, "nested", "start.sh");
    const textFilePath = path.join(sourceDir, "README.md");

    fs.writeFileSync(shellScriptPath, "#!/usr/bin/env bash\necho ready\n");
    fs.writeFileSync(textFilePath, "hello\n");
    fs.chmodSync(shellScriptPath, 0o755);
    fs.chmodSync(textFilePath, 0o644);

    const firstArchivePath = path.join(tempRoot, "first.zip");
    await writeTemplateArchive({
      sourceDir,
      outputFile: firstArchivePath,
    });

    const oldTime = new Date("2001-01-01T00:00:00.000Z");
    const newTime = new Date("2025-05-05T05:05:05.000Z");
    fs.utimesSync(shellScriptPath, oldTime, oldTime);
    fs.utimesSync(textFilePath, newTime, newTime);

    const secondArchivePath = path.join(tempRoot, "second.zip");
    await writeTemplateArchive({
      sourceDir,
      outputFile: secondArchivePath,
    });

    assert.deepEqual(readFile(secondArchivePath), readFile(firstArchivePath));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
