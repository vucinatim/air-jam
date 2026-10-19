import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import * as yauzl from "yauzl";
import {
  materializeGameBuild,
  SOURCE_ARCHIVE_MANIFEST,
} from "../src/game-build.js";
import { sourceTreeSchema } from "../src/source-tree.js";

const archiveEntries = (file: string) =>
  new Promise<Map<string, Buffer>>((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error);
      const entries = new Map<string, Buffer>();
      zip.on("entry", (entry: yauzl.Entry) => {
        if (entry.fileName.endsWith("/")) return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError);
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => {
            entries.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve(entries));
      zip.readEntry();
    }),
  );

test("source evidence keeps code whole and records large static assets by digest", async () => {
  const projectDir = await mkdtemp(
    path.join(os.tmpdir(), "airjam-source-evidence-"),
  );
  try {
    await writeFile(path.join(projectDir, "package.json"), "{}");
    await writeFile(
      path.join(projectDir, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'",
    );
    await writeFile(
      path.join(projectDir, "airjam.config.ts"),
      "export const game = 1;",
    );
    await mkdir(path.join(projectDir, "public/models"), { recursive: true });
    await writeFile(
      path.join(projectDir, "public/models/ship.glb"),
      randomBytes(400 * 1024),
    );
    await writeFile(
      path.join(projectDir, "public/icon.png"),
      randomBytes(1024),
    );
    const build = await materializeGameBuild({
      projectDir,
      configRelative: "airjam.config.ts",
      toolchain: {
        node: process.version,
        pnpm: "9.9.0",
        devtools: "test",
        platform: process.platform,
        architecture: process.arch,
        nodeAbi: process.versions.modules,
        projectRoot: projectDir,
        implementationHash: "a".repeat(64),
        environmentHash: "b".repeat(64),
      },
      async install(rootDir) {
        await mkdir(path.join(rootDir, "node_modules/.pnpm"), {
          recursive: true,
        });
        await writeFile(
          path.join(rootDir, "node_modules/.pnpm/lock.yaml"),
          "lockfileVersion: '9.0'",
        );
        return {
          durationMs: 0,
          packageCount: 0,
          reused: 0,
          downloaded: 0,
          added: 0,
          stages: [],
        };
      },
      async build(rootDir) {
        await mkdir(path.join(rootDir, "dist"), { recursive: true });
        await writeFile(path.join(rootDir, "dist/index.html"), "<html></html>");
      },
    });
    const entries = await archiveEntries(build.sourceArchivePath);
    expect(entries.get("airjam.config.ts")?.toString()).toBe(
      "export const game = 1;",
    );
    expect(entries.has("public/icon.png")).toBe(true);
    expect(entries.has("public/models/ship.glb")).toBe(false);
    const manifest = sourceTreeSchema.parse(
      JSON.parse(entries.get(SOURCE_ARCHIVE_MANIFEST)!.toString()),
    );
    expect(manifest.hash).toBe(build.manifest.sourceHash);
    expect(manifest.entries).toContainEqual(
      expect.objectContaining({
        path: "public/models/ship.glb",
        kind: "file",
        size: 400 * 1024,
      }),
    );
    expect((await readFile(build.sourceArchivePath)).length).toBe(
      build.manifest.sourceArchive.bytes,
    );
  } finally {
    await rm(projectDir, { recursive: true, force: true });
  }
});
