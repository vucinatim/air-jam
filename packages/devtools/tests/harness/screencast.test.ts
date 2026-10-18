import { EventEmitter } from "node:events";
import type { Page } from "playwright-core";
import { afterEach, expect, it, vi } from "vitest";
import type { GameRunWatchEvent } from "../../src/game-run-watch.js";
import {
  jpegDimensions,
  startGameScreencast,
} from "../../src/harness/visual/screencast.js";
const jpeg = Buffer.from([
  255, 216, 255, 192, 0, 11, 8, 0, 180, 1, 64, 3, 1, 17, 0,
]).toString("base64");
afterEach(() => vi.useRealTimers());
it("uses the JPEG's actual dimensions and refuses invalid frames", () => {
  expect(jpegDimensions(jpeg)).toEqual({ width: 320, height: 180 });
  expect(() => jpegDimensions("invalid")).toThrow("non-JPEG");
  expect(() =>
    jpegDimensions(Buffer.from([255, 216, 255, 192, 0, 20]).toString("base64")),
  ).toThrow("unavailable");
});

it("accepts capture closure proved by its closed page, while preserving detach failures on an open page", async () => {
  for (const closed of [false, true]) {
    const connection = Object.assign(new EventEmitter(), {
      send: vi.fn(async () => ({})),
      detach: vi.fn(async () => {
        throw new Error("Target context closed");
      }),
    });
    const page = Object.assign(new EventEmitter(), {
      context: () => ({ newCDPSession: async () => connection }),
      viewportSize: () => ({ width: 390, height: 844 }),
      isClosed: () => closed,
    }) as unknown as Page;
    const cast = await startGameScreencast({
      page,
      send: (_event, sent) => sent(null),
      onError: vi.fn(),
      onReady: vi.fn(),
    });
    if (closed) await expect(cast.close()).resolves.toBeUndefined();
    else await expect(cast.close()).rejects.toThrow("Target context closed");
  }
});
it("acks every capture, keeps only the latest frame during IPC pressure, and heartbeats a static scene", async () => {
  vi.useFakeTimers();
  const connection = Object.assign(new EventEmitter(), {
    send: vi.fn(async (_method: string, _parameters?: unknown) => ({})),
    detach: vi.fn(async () => {}),
  });
  const page = Object.assign(new EventEmitter(), {
    context: () => ({ newCDPSession: async () => connection }),
    viewportSize: () => ({ width: 1440, height: 1024 }),
  }) as unknown as Page;
  const output: GameRunWatchEvent[] = [];
  const callbacks: Array<(error: Error | null) => void> = [];
  const ready = vi.fn();
  const onError = vi.fn();
  const cast = await startGameScreencast({
    page,
    onReady: ready,
    onError,
    send(event, sent) {
      output.push(event);
      callbacks.push(sent);
    },
  });
  expect(connection.send).toHaveBeenCalledWith("Page.startScreencast", {
    format: "jpeg",
    quality: 75,
    maxWidth: 1280,
    maxHeight: 910,
    everyNthFrame: 1,
  });
  const capture = (sessionId: number) =>
    connection.emit("Page.screencastFrame", {
      sessionId,
      data: jpeg,
      metadata: { timestamp: 100 + sessionId },
    });
  capture(0);
  await vi.advanceTimersByTimeAsync(100);
  capture(1);
  await vi.advanceTimersByTimeAsync(100);
  capture(2);
  expect(output).toHaveLength(1);
  expect(ready).toHaveBeenCalledExactlyOnceWith({ width: 320, height: 180 });
  await vi.advanceTimersByTimeAsync(1);
  expect(
    connection.send.mock.calls.filter(
      ([method]) => method === "Page.screencastFrameAck",
    ),
  ).toHaveLength(3);
  callbacks.shift()?.(null);
  expect(output.at(-1)).toMatchObject({
    type: "frame",
    seq: 2,
    capturedAt: 102000,
  });
  callbacks.shift()?.(null);
  await vi.advanceTimersByTimeAsync(2000);
  expect(output.at(-1)).toMatchObject({ type: "heartbeat", lastFrameSeq: 2 });
  callbacks.shift()?.(null);
  await cast.close();
  await cast.close();
  const count = output.length;
  capture(3);
  await vi.advanceTimersByTimeAsync(5000);
  expect(output).toHaveLength(count);
  expect(connection.detach).toHaveBeenCalledOnce();
  expect(onError).not.toHaveBeenCalled();
});

it("delivers the final change inside one pacing interval and sends no heartbeat before ready", async () => {
  vi.useFakeTimers();
  const connection = Object.assign(new EventEmitter(), {
    send: vi.fn(async (_method: string, _parameters?: unknown) => ({})),
    detach: vi.fn(async () => {}),
  });
  const page = Object.assign(new EventEmitter(), {
    context: () => ({ newCDPSession: async () => connection }),
    viewportSize: () => ({ width: 390, height: 844 }),
  }) as unknown as Page;
  const events: GameRunWatchEvent[] = [];
  const ready = vi.fn();
  const cast = await startGameScreencast({
    page,
    onReady: ready,
    onError: (error) => {
      throw error;
    },
    send(event, sent) {
      events.push(event);
      sent(null);
    },
  });
  expect(connection.send).toHaveBeenCalledWith("Page.startScreencast", {
    format: "jpeg",
    quality: 75,
    maxWidth: 390,
    maxHeight: 844,
    everyNthFrame: 1,
  });
  await vi.advanceTimersByTimeAsync(3000);
  expect(events).toEqual([]);
  const capture = (sessionId: number) =>
    connection.emit("Page.screencastFrame", {
      sessionId,
      data: jpeg,
      metadata: { timestamp: sessionId },
    });
  capture(0);
  await vi.advanceTimersByTimeAsync(10);
  capture(1);
  expect(events.at(-1)).toMatchObject({
    type: "frame",
    seq: 1,
    capturedAt: 1000,
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(events.at(-1)).toMatchObject({ type: "heartbeat", lastFrameSeq: 1 });
  expect(ready).toHaveBeenCalledOnce();
  await cast.close();
});
