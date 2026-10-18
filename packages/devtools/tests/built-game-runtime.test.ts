import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { startBuiltGameRuntime } from "../src/built-game-runtime.js";
import { materializeGameBuild } from "../src/game-build.js";

test("the pinned runtime serves only built assets and uses one loopback relay origin", async () => {
  const projectDir = await mkdtemp(
    path.join(os.tmpdir(), "airjam-built-runtime-"),
  );
  let runtime: Awaited<ReturnType<typeof startBuiltGameRuntime>> | undefined;
  try {
    await writeFile(path.join(projectDir, "package.json"), "{}");
    await writeFile(
      path.join(projectDir, "pnpm-lock.yaml"),
      "lockfileVersion: '9.0'",
    );
    await writeFile(
      path.join(projectDir, "airjam.config.ts"),
      "private source",
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
        await mkdir(path.join(rootDir, "dist/assets"), { recursive: true });
        await writeFile(
          path.join(rootDir, "dist/index.html"),
          "<html>the exact built game</html>",
        );
        await writeFile(
          path.join(rootDir, "dist/assets/game.js"),
          "export const score = 7;",
        );
      },
    });
    runtime = await startBuiltGameRuntime(build.manifestPath);
    const url = new URL(runtime.urls.hostUrl);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("aj_topology_runtime_mode")).toBe(
      "self-hosted-production",
    );
    expect(url.searchParams.get("aj_topology_backend_origin")).toBe(url.origin);
    expect(await (await fetch(url)).text()).toBe(
      "<html>the exact built game</html>",
    );
    expect(
      await (
        await fetch(new URL("/play/phone", url), {
          headers: { accept: "text/html" },
        })
      ).text(),
    ).toBe("<html>the exact built game</html>");
    expect((await fetch(new URL("/play/phone", url))).status).toBe(404);
    const script = await fetch(new URL("/assets/game.js", url));
    expect(script.headers.get("content-type")).toContain("javascript");
    expect(script.headers.get("cache-control")).toBe("no-store");
    expect(await script.text()).toBe("export const score = 7;");
    expect(
      (await fetch(new URL("/assets/game.js", url), { method: "HEAD" })).status,
    ).toBe(200);
    for (const target of [
      "/airjam.config.ts",
      "/@vite/client",
      "/source.zip",
      "/package.json",
      "/%2e%2e/source/package.json",
    ])
      expect((await fetch(new URL(target, url))).status).toBe(404);
    expect(
      (await fetch(new URL("/host", url), { method: "POST" })).status,
    ).toBe(405);
    expect((await (await fetch(new URL("/health", url))).json()).ok).toBe(true);
  } finally {
    await runtime?.close();
    await rm(projectDir, { recursive: true, force: true });
  }
});
