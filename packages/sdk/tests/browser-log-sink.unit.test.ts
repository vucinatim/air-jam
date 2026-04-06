// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureDevBrowserLogSink,
  resolveBrowserConsoleCategory,
} from "../src/dev/browser-log-sink";

const originalConsole = {
  debug: console.debug,
  info: console.info,
  log: console.log,
  warn: console.warn,
  error: console.error,
};

describe("browser log sink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
      })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    delete (
      globalThis as {
        __airJamBrowserLogSink__?: unknown;
        __airJamDevLogContext__?: unknown;
        __airJamHostTraceId__?: unknown;
      }
    ).__airJamDevLogContext__;
    delete (
      globalThis as {
        __airJamBrowserLogSink__?: unknown;
        __airJamDevLogContext__?: unknown;
        __airJamHostTraceId__?: unknown;
      }
    ).__airJamHostTraceId__;
    (
      globalThis as {
        __airJamBrowserLogSink__?: { dispose?: () => void };
      }
    ).__airJamBrowserLogSink__?.dispose?.();
    delete (
      globalThis as {
        __airJamBrowserLogSink__?: unknown;
      }
    ).__airJamBrowserLogSink__;
  });

  it("categorizes known Air Jam, framework, browser, and app console messages", () => {
    expect(resolveBrowserConsoleCategory(["[Arcade] Launching game"])).toBe(
      "airjam",
    );
    expect(
      resolveBrowserConsoleCategory([
        "%c >> query #1 %cgame.getAllPublic%c %O",
      ]),
    ).toBe("framework");
    expect(resolveBrowserConsoleCategory(["[Fast Refresh] rebuilding"])).toBe(
      "framework",
    );
    expect(
      resolveBrowserConsoleCategory([
        'Image with src "/images/airjam-logo.png" was detected as the Largest Contentful Paint',
      ]),
    ).toBe("browser");
    expect(resolveBrowserConsoleCategory(["Custom game debug message"])).toBe(
      "app",
    );
  });

  it("sends explicit unload runtime events through navigator.sendBeacon", async () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });

    ensureDevBrowserLogSink({
      serverUrl: "http://localhost:3001",
      appId: "aj_app_test",
    });

    window.dispatchEvent(new Event("pagehide"));

    const calls = sendBeacon.mock.calls as unknown[][];
    const unloadCall = calls.find(
      (call) => call[0] === "http://localhost:3001/__airjam/dev/browser-unload",
    );
    expect(unloadCall).toBeTruthy();
    const body = unloadCall?.[1];
    expect(typeof body).toBe("string");
    const payload = JSON.parse(body as string) as {
      entry: Record<string, unknown>;
    };
    expect(payload.entry).toMatchObject({
      source: "runtime",
      event: "runtime.window.pagehide",
      message: "Window pagehide observed",
    });
    expect(typeof payload.entry.sourceSeq).toBe("number");
  });

  it("updates early browser error batches when explicit config becomes available", async () => {
    const fetchMock = vi.mocked(fetch);

    ensureDevBrowserLogSink({});

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "DeviceOrientationEvent is not defined",
      }),
    );

    await vi.advanceTimersByTimeAsync(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://localhost:3000/__airjam/dev/browser-logs",
    );

    ensureDevBrowserLogSink({
      serverUrl: "http://localhost:3001",
      appId: "aj_app_test",
    });

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Second controller failure",
      }),
    );

    await vi.advanceTimersByTimeAsync(250);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [endpoint, init] = fetchMock.mock.calls[1] ?? [];
    expect(endpoint).toBe("http://localhost:3001/__airjam/dev/browser-logs");
    expect(init && typeof init === "object" && "body" in init).toBe(true);

    const payload = JSON.parse((init as RequestInit).body as string) as {
      entries: Array<Record<string, unknown>>;
      metadata: Record<string, unknown>;
    };

    expect(payload.metadata.appId).toBe("aj_app_test");
    expect(payload.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "window-error",
          level: "error",
          message: "Second controller failure",
        }),
      ]),
    );
  });

  it("falls back to the same-origin dev proxy when no explicit server URL is provided", async () => {
    const fetchMock = vi.mocked(fetch);

    ensureDevBrowserLogSink({});

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "Controller render failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(250);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0] ?? [];
    expect(endpoint).toBe("http://localhost:3000/__airjam/dev/browser-logs");
    expect(init && typeof init === "object" && "body" in init).toBe(true);

    const payload = JSON.parse((init as RequestInit).body as string) as {
      entries: Array<Record<string, unknown>>;
    };

    expect(payload.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "window-error",
          message: "Controller render failed",
        }),
      ]),
    );
  });
});
