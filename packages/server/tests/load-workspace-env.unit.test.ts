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

  mkdirSync(serverDir, { recursive: true });

  const rootEnvLocal = join(root, ".env.local");
  const serverEnv = join(serverDir, ".env");

  writeFileSync(rootEnvLocal, "ROOT_ONLY=root\nSHARED=from-root\n", "utf8");
  writeFileSync(serverEnv, "SERVER_ONLY=server\nSHARED=from-server\n", "utf8");

  return {
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
});
