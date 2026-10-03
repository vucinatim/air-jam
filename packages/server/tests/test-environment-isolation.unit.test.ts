import { describe, expect, it } from "vitest";
import { loadServerEnv } from "../src/env/server-env";

// Captured during test-module evaluation, not inside a hook: setup must run
// before any runtime consumer can resolve inherited developer configuration.
const importedEnvironment = loadServerEnv();

describe("server test environment isolation", () => {
  it("removes default database and dev-log authority before test imports", () => {
    expect(importedEnvironment.databaseUrl).toBeUndefined();
    expect(importedEnvironment.devLogCollectorEnabled).toBe(false);
    expect(importedEnvironment.devLogDir).toBeUndefined();
  });

  it("preserves the separate explicit PostgreSQL opt-in", async () => {
    // Import after capturing defaults above, so this test cannot accidentally
    // supply the missing setup boundary that the first regression verifies.
    const { isolateServerTestEnvironment } = await import("./setup");
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: "postgresql://127.0.0.1:1/developer_database",
      AIR_JAM_DEV_LOG_DIR: "/developer/logs",
      AIR_JAM_DEV_LOG_COLLECTOR: "enabled",
      AIR_JAM_TEST_DATABASE_URL: "postgresql://127.0.0.1:1/test_fixture",
    };

    isolateServerTestEnvironment(env);

    expect(env).toEqual({
      AIR_JAM_DEV_LOG_COLLECTOR: "disabled",
      AIR_JAM_TEST_DATABASE_URL: "postgresql://127.0.0.1:1/test_fixture",
    });
  });
});
