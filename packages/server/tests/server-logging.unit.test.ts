import { describe, expect, it, vi } from "vitest";
import { loadServerEnv } from "../src/env/server-env.js";
import { createServerLogger } from "../src/logging/logger.js";
import { createRoomServer } from "../src/room-server/room-server.js";
import { createOpenRoomGate } from "../src/room/gate.js";

const silentLogger = () =>
  createServerLogger(undefined, undefined, undefined, { level: "silent" });

describe("room server authentication reporting", () => {
  it("warns once when a production server admits every host", async () => {
    const logger = silentLogger();
    const warn = vi.spyOn(logger, "warn");
    const runtime = createRoomServer({
      logger,
      devLogCollector: false,
      envConfig: loadServerEnv({
        NODE_ENV: "production",
        AIR_JAM_AUTH_MODE: "disabled",
      }),
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

  it("reports master-key admission without logging the key", async () => {
    const logger = silentLogger();
    const info = vi.spyOn(logger, "info");
    const runtime = createRoomServer({
      logger,
      devLogCollector: false,
      envConfig: loadServerEnv({
        NODE_ENV: "test",
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_MASTER_KEY: "test-only-key",
      }),
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

  it("leaves reporting to a gate passed in", async () => {
    const logger = silentLogger();
    const warn = vi.spyOn(logger, "warn");
    const runtime = createRoomServer({
      logger,
      devLogCollector: false,
      gate: createOpenRoomGate(),
      envConfig: loadServerEnv({
        NODE_ENV: "production",
        AIR_JAM_AUTH_MODE: "disabled",
      }),
    });
    try {
      expect(warn).not.toHaveBeenCalled();
    } finally {
      await runtime.stop();
    }
  });
});
