import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAirJamLogProjectRoot } from "../src/logging/log-paths";

const tempDirs: string[] = [];

const createTempDir = (prefix: string): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("log path resolution", () => {
  it("uses generated project cwd when the cwd package is not @air-jam/server", () => {
    const projectDir = createTempDir("air-jam-log-root-project-");
    fs.writeFileSync(
      path.join(projectDir, "package.json"),
      JSON.stringify({ name: "my-airjam-game" }),
      "utf8",
    );

    expect(
      resolveAirJamLogProjectRoot({
        cwd: projectDir,
        moduleUrl: "file:///ignored/packages/server/dist/chunk.js",
      }),
    ).toBe(projectDir);
  });

  it("falls back to the server workspace root when cwd is the server package", () => {
    const repoRoot = createTempDir("air-jam-log-root-repo-");
    const serverDir = path.join(repoRoot, "packages", "server");
    const loggingModuleUrl = `file://${path.join(
      repoRoot,
      "packages",
      "server",
      "dist",
      "chunk.js",
    )}`;

    fs.mkdirSync(serverDir, { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "pnpm-workspace.yaml"),
      "packages:\n  - packages/*\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(serverDir, "package.json"),
      JSON.stringify({ name: "@air-jam/server" }),
      "utf8",
    );

    expect(
      resolveAirJamLogProjectRoot({
        cwd: serverDir,
        moduleUrl: loggingModuleUrl,
      }),
    ).toBe(repoRoot);
  });
});
