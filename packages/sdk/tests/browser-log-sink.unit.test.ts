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
    ).__airJamBrowserLogSink__;
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
});
