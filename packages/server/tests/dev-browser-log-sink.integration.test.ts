import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAirJamServer, type AirJamServerRuntime } from "../src/index";
import { io, type Socket } from "socket.io-client";

describe("dev browser log sink", () => {
  let runtime: AirJamServerRuntime | null = null;
  let baseUrl = "";
  let tempDir = "";
  let socket: Socket | null = null;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "air-jam-browser-logs-"));
    runtime = createAirJamServer({
      devLogDir: tempDir,
      authService: {
        verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
          isVerified: true,
          appId,
          verifiedVia: "appId" as const,
        }),
      } as any,
    });
    const port = await runtime.start(0);
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    socket?.disconnect();
    socket = null;

    if (runtime) {
      await runtime.stop();
      runtime = null;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("writes server and browser events into one canonical dev file", async () => {
    socket = io(baseUrl, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      socket!.once("connect", () => resolve());
      socket!.once("connect_error", (error) => reject(error));
    });

    const bootstrapAck = await new Promise<{ ok: boolean; traceId?: string }>(
      (resolve) => {
        socket!.emit("host:bootstrap", { appId: "aj_app_test123" }, resolve);
      },
    );

    expect(bootstrapAck.ok).toBe(true);
    expect(bootstrapAck.traceId).toBeTruthy();

    const resetResponse = await fetch(`${baseUrl}/__airjam/dev/browser-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mode: "reset",
        sessionId: "session-one",
        metadata: {
          appId: "aj_app_test123",
          traceId: bootstrapAck.traceId,
          origin: "http://localhost:5173",
          pathname: "/",
        },
        entries: [
          {
            time: "2026-03-26T20:00:00.000Z",
            level: "info",
            source: "console",
            message: "hello from browser",
          },
        ],
      }),
    });

    expect(resetResponse.status).toBe(200);

    const appendResponse = await fetch(`${baseUrl}/__airjam/dev/browser-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mode: "append",
        sessionId: "session-one",
        metadata: {
          appId: "aj_app_test123",
          traceId: bootstrapAck.traceId,
          origin: "http://localhost:5173",
          pathname: "/play",
        },
        entries: [
          {
            time: "2026-03-26T20:00:01.000Z",
            level: "error",
            source: "window-error",
            message: "boom",
            stack: "Error: boom",
          },
        ],
      }),
    });

    expect(appendResponse.status).toBe(200);

    const latestContents = await readFile(path.join(tempDir, "dev-latest.ndjson"), "utf8");

    expect(latestContents).toContain('"source":"server"');
    expect(latestContents).toContain('"source":"browser"');
    expect(latestContents).toContain('"msg":"Host bootstrap verified"');
    expect(latestContents).toContain('"msg":"hello from browser"');
    expect(latestContents).toContain(`"traceId":"${bootstrapAck.traceId}"`);
    expect(latestContents).toContain('"sessionId":"session-one"');
  });

  it("rejects malformed payloads", async () => {
    const response = await fetch(`${baseUrl}/__airjam/dev/browser-logs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
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
