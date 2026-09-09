import type { Browser, BrowserContext, Page } from "playwright-core";
import { describe, expect, it, vi } from "vitest";
import { openVisualHarnessHostSession } from "../src/visual/session.js";

describe("visual harness session membership", () => {
  it("opens only the host surface until a controller surface is requested", async () => {
    const goto = vi.fn(async () => null);
    const close = vi.fn(async () => undefined);
    const hostPage = { goto } as unknown as Page;
    const hostContext = {
      newPage: vi.fn(async () => hostPage),
      close,
    } as unknown as BrowserContext;
    const newContext = vi.fn(async () => hostContext);
    const browser = { newContext } as unknown as Browser;

    const session = await openVisualHarnessHostSession({
      browser,
      mode: "standalone-dev",
      urls: {
        appOrigin: "http://127.0.0.1:7777",
        hostUrl: "http://127.0.0.1:7777",
        controllerBaseUrl: "http://127.0.0.1:7777/controller",
        publicHost: "http://127.0.0.1:7777",
        localBuildUrl: null,
        browserBuildUrl: null,
      },
    });

    expect(newContext).toHaveBeenCalledTimes(1);
    expect(newContext).toHaveBeenCalledWith({
      viewport: { width: 1440, height: 1024 },
    });
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith("http://127.0.0.1:7777", {
      waitUntil: "domcontentloaded",
    });
    expect(session.urls.controllerJoinUrl).toBeNull();

    await session.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
