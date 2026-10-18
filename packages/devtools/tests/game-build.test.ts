import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  truncate,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";
import {
  enforceGameBuildCacheLimits,
  GAME_BUILD_CACHE_MAXIMUM_BYTES,
  materializeGameBuild,
  verifyPinnedGameBuild,
} from "../src/game-build.js";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function fixture() {
  const projectDir = await mkdtemp(
    path.join(os.tmpdir(), "airjam-game-build-"),
  );
  directories.push(projectDir);
  await writeFile(path.join(projectDir, "package.json"), "{}");
  await writeFile(
    path.join(projectDir, "pnpm-lock.yaml"),
    "lockfileVersion: '9.0'\n",
  );
  await writeFile(
    path.join(projectDir, "airjam.config.ts"),
    "export default {};",
  );
  const install = vi.fn(async (rootDir: string) => {
    await mkdir(path.join(rootDir, "node_modules/.pnpm"), { recursive: true });
    await writeFile(
      path.join(rootDir, "node_modules/.pnpm/lock.yaml"),
      await readFile(path.join(rootDir, "pnpm-lock.yaml")),
    );
    await writeFile(
      path.join(rootDir, "node_modules/package.js"),
      "installed code",
    );
    return {
      durationMs: 0,
      packageCount: 1,
      reused: 1,
      downloaded: 0,
      added: 1,
      stages: [],
    };
  });
  const build = vi.fn(async (rootDir: string) => {
    await mkdir(path.join(rootDir, "dist"));
    await writeFile(
      path.join(rootDir, "dist/index.html"),
      await readFile(path.join(rootDir, "airjam.config.ts")),
    );
  });
  return {
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
    install,
    build,
  };
}
test("cache reuse re-verifies source, distribution and original archive without rerunning the build", async () => {
  const options = await fixture();
  const first = await materializeGameBuild(options);
  expect(first.reused).toBe(false);
  expect(first.rootDir).not.toBe(options.projectDir);
  await expect(verifyPinnedGameBuild(first)).resolves.toBeUndefined();
  const second = await materializeGameBuild(options);
  expect(second.reused).toBe(true);
  expect(second.manifest).toEqual(first.manifest);
  expect(options.install).toHaveBeenCalledTimes(1);
  expect(options.build).toHaveBeenCalledTimes(1);
  await writeFile(path.join(first.distDir, "index.html"), "tampered");
  await expect(materializeGameBuild(options)).rejects.toThrow(
    "build_integrity_changed",
  );
  expect(options.build).toHaveBeenCalledTimes(1);
});
test("source changes produce another exact build while retaining the previous source", async () => {
  const options = await fixture();
  const first = await materializeGameBuild(options);
  await writeFile(path.join(options.projectDir, "airjam.config.ts"), "changed");
  const second = await materializeGameBuild(options);
  expect(second.manifest.buildKey).not.toBe(first.manifest.buildKey);
  expect(second.manifest.sourceHash).not.toBe(first.manifest.sourceHash);
  expect(
    await readFile(path.join(first.rootDir, "airjam.config.ts"), "utf8"),
  ).toBe("export default {};");
  await verifyPinnedGameBuild(first);
  await verifyPinnedGameBuild(second);
});
test("failed builds and builders that modify source never publish a cache manifest", async () => {
  const options = await fixture();
  options.build.mockRejectedValueOnce(new Error("compiler failed"));
  await expect(materializeGameBuild(options)).rejects.toThrow(
    "compiler failed",
  );
  expect(
    await readdir(
      path.join(options.projectDir, ".airjam/devtools/game-builds"),
    ),
  ).toEqual([]);
  options.build.mockImplementationOnce(async (rootDir) => {
    await writeFile(
      path.join(rootDir, "airjam.config.ts"),
      "edited during build",
    );
  });
  await expect(materializeGameBuild(options)).rejects.toThrow(
    "build_source_changed",
  );
  expect(
    await readdir(
      path.join(options.projectDir, ".airjam/devtools/game-builds"),
    ),
  ).toEqual([]);
});

test("cache evicts oldest builds to satisfy both byte and entry limits without following symlinks", async () => {
  const { projectDir } = await fixture();
  const cache = path.join(projectDir, "cache");
  await mkdir(cache);
  const keys = ["a", "b", "c", "d"].map((letter) => letter.repeat(64));
  for (const [index, key] of keys.entries()) {
    const directory = path.join(cache, key);
    await mkdir(directory);
    const file = path.join(directory, "dependencies");
    await writeFile(file, "");
    await truncate(file, Math.floor(GAME_BUILD_CACHE_MAXIMUM_BYTES / 3));
    await utimes(directory, index + 1, index + 1);
  }
  const outside = path.join(projectDir, "model-artifacts");
  await mkdir(outside);
  await writeFile(path.join(outside, "model"), "");
  await truncate(
    path.join(outside, "model"),
    GAME_BUILD_CACHE_MAXIMUM_BYTES * 2,
  );
  await symlink(outside, path.join(cache, keys[3], "external"));
  await enforceGameBuildCacheLimits(cache, keys[3]);
  // The symlink's own bytes put three entries over the limit, so both oldest builds leave.
  expect((await readdir(cache)).sort()).toEqual(keys.slice(2));
  expect(await readdir(outside)).toEqual(["model"]);
});

test("an oversized current build is refused before evicting recoverable older builds", async () => {
  const { projectDir } = await fixture();
  const cache = path.join(projectDir, "cache");
  const current = "a".repeat(64);
  const previous = "b".repeat(64);
  await mkdir(path.join(cache, current), { recursive: true });
  await mkdir(path.join(cache, previous));
  const file = path.join(cache, current, "dependencies");
  await writeFile(file, "");
  await truncate(file, GAME_BUILD_CACHE_MAXIMUM_BYTES + 1);
  await expect(enforceGameBuildCacheLimits(cache, current)).rejects.toThrow(
    "build_cache_too_large",
  );
  expect((await readdir(cache)).sort()).toEqual([current, previous]);
});
