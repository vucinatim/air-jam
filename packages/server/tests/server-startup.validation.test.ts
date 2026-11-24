import { afterEach, describe, expect, it, vi } from "vitest";
import { loadServerEnv } from "../src/env/server-env";
import { createRoomServer } from "../src/room-server/room-server";

const ORIGINAL_ENV = { ...process.env };

const resetEnv = (): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
};

afterEach(() => {
  resetEnv();
});

describe("room server startup validation", () => {
  it("fails fast when required auth has no master key", () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    delete process.env.AIR_JAM_MASTER_KEY;

    expect(() => createRoomServer()).toThrow(
      "Required authentication needs a gate",
    );
  });
});

it.each([
  { environment: {}, host: undefined, expected: { port: 4000 } },
  {
    environment: { AIR_JAM_BIND_HOST: " " },
    host: undefined,
    expected: { port: 4000 },
  },
  {
    environment: { AIR_JAM_BIND_HOST: " 127.0.0.1 " },
    host: undefined,
    expected: { port: 4000, host: "127.0.0.1" },
  },
  {
    environment: { AIR_JAM_BIND_HOST: "127.0.0.1" },
    host: "::1",
    expected: { port: 4000, host: "::1" },
  },
])(
  "passes the bind input to the listener and preserves explicit host precedence: $expected",
  async ({ environment, host, expected }) => {
    const runtime = createRoomServer({
      host,
      envConfig: loadServerEnv({
        ...environment,
        AIR_JAM_DEV_LOG_COLLECTOR: "disabled",
        AIR_JAM_LOG_LEVEL: "silent",
      }),
    });
    const listen = vi
      .spyOn(runtime.httpServer, "listen")
      .mockImplementation((...argumentsList) => {
        const callback = argumentsList.at(-1);
        if (typeof callback === "function") callback();
        return runtime.httpServer;
      });
    try {
      await runtime.start();
      expect(listen).toHaveBeenCalledWith(expected, expect.any(Function));
    } finally {
      await runtime.stop();
    }
  },
);
