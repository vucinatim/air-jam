import {
  createWebSocketConnector,
  HostRoomSession,
} from "@air-jam/sdk/room-session";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadServerEnv } from "../src/env/server-env.js";
import { DevLogCollector } from "../src/logging/dev-log-collector.js";
import { createServerLogger } from "../src/logging/logger.js";
import {
  createRoomServer,
  type RoomServerRuntime,
} from "../src/room-server/room-server.js";

const until = async (condition: () => boolean, deadlineMs = 5_000) => {
  const deadline = Date.now() + deadlineMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("The condition never held.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

let server: RoomServerRuntime | null = null;
let tempDir = "";

afterEach(async () => {
  await server?.stop();
  server = null;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = "";
});

const start = async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "air-jam-browser-logs-"));
  const collector = new DevLogCollector({ enabled: true, logDir: tempDir });
  server = createRoomServer({
    envConfig: loadServerEnv({}),
    logger: createServerLogger(undefined, undefined, collector),
    devLogCollector: collector,
  });
  const port = await server.start(0);
  return { runtime: server, baseUrl: `http://127.0.0.1:${port}` };
};

describe("dev browser log sink", () => {
  it("writes the room's facts and the browser's events into one dev file", async () => {
    const { runtime, baseUrl } = await start();
    const response = await fetch(`${baseUrl}/__airjam/dev/browser-logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "reset",
        sessionId: "session-one",
        metadata: {
          appId: "aj_app_test123",
          origin: "http://localhost:5173",
          pathname: "/",
        },
        entries: [
          {
            occurredAt: "2026-03-26T20:00:00.000Z",
            level: "info",
            source: "console",
            sourceSeq: 1,
            message: "hello from browser",
            consoleCategory: "app",
          },
        ],
      }),
    });
    expect(response.status).toBe(200);
    const host = new HostRoomSession({
      connector: createWebSocketConnector(baseUrl),
      key: "host-key-00000001",
      seats: 2,
      deviceWakeEvents: null,
    });
    await until(() => host.status.phase === "open");
    host.close();
    await runtime.flushDevLogs();

    const events = (
      await readFile(path.join(tempDir, "dev-latest.ndjson"), "utf8")
    )
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events).toContainEqual(
      expect.objectContaining({ event: "room.opened", roomId: host.code }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ msg: "hello from browser" }),
    );
  });

  it("rejects malformed payloads", async () => {
    const { baseUrl } = await start();
    const response = await fetch(`${baseUrl}/__airjam/dev/browser-logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "reset",
        sessionId: "session-one",
        metadata: {},
        entries: [],
      }),
    });
    expect(response.status).toBe(400);
  });
});
