import { describe, expect, it, vi } from "vitest";
import { loadServerEnv } from "../src/env/server-env.js";
import { createAirJamServer } from "../src/index.js";
import { createServerLogger } from "../src/logging/logger.js";
import { createServerLogging } from "../src/logging/server-logging.js";

describe("server logging composition", () => {
  it("warns once when the built-in production server accepts any host", async () => {
    const envConfig = loadServerEnv({
      NODE_ENV: "production",
      AIR_JAM_AUTH_MODE: "disabled",
    });
    const logger = createServerLogger(undefined, undefined, undefined, {
      level: "silent",
    });
    const warn = vi.spyOn(logger, "warn");
    const runtime = createAirJamServer({
      logger,
      devLogCollector: false,
      envConfig,
    });
    try {
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        { event: "auth.mode.disabled", authMode: "disabled" },
        expect.any(String),
      );
    } finally {
      await runtime.stop();
    }
  });

  it("reports local master-key authentication without logging the key", async () => {
    const envConfig = loadServerEnv({
      NODE_ENV: "test",
      AIR_JAM_AUTH_MODE: "required",
      AIR_JAM_MASTER_KEY: "test-only-key",
    });
    const logger = createServerLogger(undefined, undefined, undefined, {
      level: "silent",
    });
    const info = vi.spyOn(logger, "info");
    const runtime = createAirJamServer({
      logger,
      devLogCollector: false,
      envConfig,
    });
    try {
      expect(info).toHaveBeenCalledExactlyOnceWith(
        { event: "auth.mode.master_key", authMode: "required" },
        expect.any(String),
      );
    } finally {
      await runtime.stop();
    }
  });

  it("leaves injected authentication reporting to the adapter", async () => {
    const envConfig = loadServerEnv({
      NODE_ENV: "production",
      AIR_JAM_AUTH_MODE: "disabled",
    });
    const logger = createServerLogger(undefined, undefined, undefined, {
      level: "silent",
    });
    const warn = vi.spyOn(logger, "warn");
    const runtime = createAirJamServer({
      logger,
      devLogCollector: false,
      envConfig,
      authService: { verifyHostBootstrap: async () => ({ isVerified: false }) },
    });
    try {
      expect(warn).not.toHaveBeenCalled();
    } finally {
      await runtime.stop();
    }
  });

  it("preserves disabled collection through exported logging and server options", async () => {
    const envConfig = loadServerEnv({ NODE_ENV: "test" });
    const logger = createServerLogger(undefined, undefined, undefined, {
      level: "silent",
    });
    const logging = createServerLogging(
      { logger, devLogCollector: false },
      envConfig,
    );
    expect(logging.devLogCollector).toBe(false);
    expect(createServerLogging(logging, envConfig).devLogCollector).toBe(false);
    const info = vi.spyOn(logger, "info");
    const runtime = createAirJamServer({ ...logging, envConfig });
    try {
      await runtime.start(0);
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({ authMode: "disabled" }),
        expect.any(String),
      );
    } finally {
      await runtime.stop();
    }
  });
});
