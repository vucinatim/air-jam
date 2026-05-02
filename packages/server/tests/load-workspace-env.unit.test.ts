import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadWorkspaceEnv,
  resetWorkspaceEnvLoaderForTests,
} from "../src/env/load-workspace-env";

afterEach(() => {
  resetWorkspaceEnvLoaderForTests();
});

const createEnvFixture = () => {
  const root = mkdtempSync(join(tmpdir(), "air-jam-env-"));
  const serverDir = join(root, "packages", "server");
  const appDir = join(root, "apps", "demo");

  mkdirSync(serverDir, { recursive: true });
  mkdirSync(appDir, { recursive: true });

  const rootEnvLocal = join(root, ".env.local");
  const serverEnv = join(serverDir, ".env");
  const appEnvLocal = join(appDir, ".env.local");

  writeFileSync(rootEnvLocal, "ROOT_ONLY=root\nSHARED=from-root\n", "utf8");
  writeFileSync(serverEnv, "SERVER_ONLY=server\nSHARED=from-server\n", "utf8");
  writeFileSync(appEnvLocal, "APP_ONLY=app\nSHARED=from-app\n", "utf8");

  return {
    appDir,
    rootEnvLocal,
    serverEnv,
  };
};

describe("loadWorkspaceEnv", () => {
  it("loads only repo-root and server-owned env files", () => {
    const processEnv: Record<string, string | undefined> = {};
    const candidates = createEnvFixture();

    loadWorkspaceEnv({ candidates, processEnv });

    expect(processEnv.ROOT_ONLY).toBe("root");
    expect(processEnv.SERVER_ONLY).toBe("server");
    expect(processEnv.SHARED).toBe("from-root");
  });

  it("prefers the app cwd .env.local when running from an installed consumer", () => {
    const processEnv: Record<string, string | undefined> = {};
    const candidates = createEnvFixture();

    loadWorkspaceEnv({
      cwd: candidates.appDir,
      candidates,
      processEnv,
    });

    expect(processEnv.APP_ONLY).toBe("app");
    expect(processEnv.ROOT_ONLY).toBe("root");
    expect(processEnv.SERVER_ONLY).toBe("server");
    expect(processEnv.SHARED).toBe("from-app");
  });
});
