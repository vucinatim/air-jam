import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const page = {
    goto: vi.fn(),
    waitForTimeout: vi.fn(),
    screenshot: vi.fn(),
  };
  const context = {
    route: vi.fn(),
    on: vi.fn(),
    newPage: vi.fn(),
    close: vi.fn(),
  };
  const browser = { newContext: vi.fn(), close: vi.fn() };
  return {
    page,
    context,
    browser,
    connect: vi.fn(),
    launch: vi.fn(),
    putObject: vi.fn(),
  };
});
vi.mock("playwright-core", () => ({
  chromium: { connect: mocks.connect, launch: mocks.launch },
}));
vi.mock("./release-moderation-config", () => ({
  getReleaseModerationConfig: () => ({
    internalAccessSecret: "private-signing-secret",
    browserLaunch: {
      wsEndpoint: "wss://worker.example.test/ws",
      accessToken: "worker-access-secret",
      navigationTimeoutMs: 20000,
      waitAfterLoadMs: 1000,
      viewportWidth: 1440,
      viewportHeight: 900,
    },
  }),
}));
vi.mock("./release-public-url", () => ({
  buildHostedReleaseAssetUrl: ({ assetPath }: { assetPath: string }) =>
    `https://games.example.test/releases/g/game/r/release/generations/generation${assetPath ? `/${assetPath}` : ""}`,
}));
vi.mock("./release-storage", () => ({
  getReleaseStorage: () => ({ putObject: mocks.putObject }),
}));

import { captureReleaseScreenshot } from "./release-screenshot-service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockResolvedValue(mocks.browser);
  mocks.browser.newContext.mockResolvedValue(mocks.context);
  mocks.context.newPage.mockResolvedValue(mocks.page);
  mocks.page.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
  mocks.page.screenshot.mockResolvedValue(Buffer.from("fixture-png"));
});

afterEach(() => vi.useRealTimers());

describe("release screenshot capture", () => {
  it("captures the declared viewport with private routing rather than context-wide credentials", async () => {
    const result = await captureReleaseScreenshot({
      gameId: "game",
      releaseId: "release",
      generationId: "generation",
      captureId: "capture",
    });
    expect(mocks.connect).toHaveBeenCalledWith("wss://worker.example.test/ws", {
      timeout: 20000,
      headers: { authorization: "Bearer worker-access-secret" },
    });
    expect(mocks.browser.newContext).toHaveBeenCalledWith({
      serviceWorkers: "block",
      acceptDownloads: false,
      viewport: { width: 1440, height: 900 },
    });
    expect(mocks.context.route).toHaveBeenCalledWith(
      "**/*",
      expect.any(Function),
    );
    expect(mocks.page.screenshot).toHaveBeenCalledWith({
      type: "png",
      fullPage: false,
      timeout: 20000,
    });
    expect(result).toMatchObject({
      generationId: "generation",
      captureId: "capture",
      width: 1440,
      height: 900,
      sizeBytes: 11,
    });
    expect(mocks.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        writeMode: "create",
        contentType: "image/png",
      }),
    );
    expect(mocks.context.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
    expect(mocks.launch).not.toHaveBeenCalled();
    expect(mocks.putObject.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.browser.close.mock.invocationCallOrder[0],
    );
  });

  it("closes owned browser resources and writes no object after capture failure", async () => {
    mocks.page.screenshot.mockRejectedValue(new Error("capture timeout"));
    await expect(
      captureReleaseScreenshot({
        gameId: "game",
        releaseId: "release",
        generationId: "generation",
      }),
    ).rejects.toThrow("capture timeout");
    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.context.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("closes unsolicited popup pages without closing the primary page", async () => {
    const popup = { close: vi.fn().mockResolvedValue(undefined) };
    mocks.page.goto.mockImplementation(async () => {
      const onPage = mocks.context.on.mock.calls.find(
        ([event]) => event === "page",
      )?.[1];
      expect(onPage).toBeTypeOf("function");
      onPage(mocks.page);
      onPage(popup);
      return { ok: () => true, status: () => 200 };
    });
    await captureReleaseScreenshot({
      gameId: "game",
      releaseId: "release",
      generationId: "generation",
    });
    expect(popup.close).toHaveBeenCalledOnce();
    expect(mocks.context.newPage).toHaveBeenCalledOnce();
    expect(mocks.context.on).toHaveBeenCalledWith("page", expect.any(Function));
  });

  it.each([403, 404, 500, 503])(
    "does not capture or store an HTTP %s error page",
    async (status) => {
      mocks.page.goto.mockResolvedValue({
        ok: () => false,
        status: () => status,
      });
      await expect(
        captureReleaseScreenshot({
          gameId: "game",
          releaseId: "release",
          generationId: "generation",
        }),
      ).rejects.toThrow(`host returned HTTP ${status}`);
      expect(mocks.page.screenshot).not.toHaveBeenCalled();
      expect(mocks.putObject).not.toHaveBeenCalled();
      expect(mocks.context.close).toHaveBeenCalledOnce();
      expect(mocks.browser.close).toHaveBeenCalledOnce();
    },
  );

  it("requires an HTTP response before capturing a hosted release", async () => {
    mocks.page.goto.mockResolvedValue(null);
    await expect(
      captureReleaseScreenshot({
        gameId: "game",
        releaseId: "release",
        generationId: "generation",
      }),
    ).rejects.toThrow("did not return an HTTP response");
    expect(mocks.page.screenshot).not.toHaveBeenCalled();
    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("rejects oversized output before storage after closing browser resources", async () => {
    mocks.page.screenshot.mockResolvedValue(Buffer.alloc(16 * 1024 * 1024 + 1));
    await expect(
      captureReleaseScreenshot({
        gameId: "game",
        releaseId: "release",
        generationId: "generation",
      }),
    ).rejects.toThrow("16 MiB");
    expect(mocks.putObject).not.toHaveBeenCalled();
    expect(mocks.context.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
  });

  it("accepts the exact output-size bound", async () => {
    mocks.page.screenshot.mockResolvedValue(Buffer.alloc(16 * 1024 * 1024));
    const result = await captureReleaseScreenshot({
      gameId: "game",
      releaseId: "release",
      generationId: "generation",
    });
    expect(result.sizeBytes).toBe(16 * 1024 * 1024);
    expect(mocks.putObject).toHaveBeenCalledOnce();
  });

  it("bounds the entire browser capture, including time spent connecting", async () => {
    vi.useFakeTimers();
    mocks.connect.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mocks.browser), 20_000),
        ),
    );
    mocks.page.goto.mockReturnValue(new Promise(() => undefined));
    const capture = captureReleaseScreenshot({
      gameId: "game",
      releaseId: "release",
      generationId: "generation",
    });
    const rejected = expect(capture).rejects.toThrow("90-second deadline");
    await vi.advanceTimersByTimeAsync(89_999);
    expect(mocks.browser.close).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await rejected;
    expect(mocks.context.close).toHaveBeenCalledOnce();
    expect(mocks.browser.close).toHaveBeenCalledOnce();
    expect(mocks.putObject).not.toHaveBeenCalled();
  });

  it("bounds failed cleanup and does not store the capture", async () => {
    vi.useFakeTimers();
    mocks.context.close.mockReturnValue(new Promise(() => undefined));
    const capture = captureReleaseScreenshot({
      gameId: "game",
      releaseId: "release",
      generationId: "generation",
    });
    const rejected = expect(capture).rejects.toThrow("cleanup timed out");
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    expect(mocks.browser.close).toHaveBeenCalledOnce();
    expect(mocks.putObject).not.toHaveBeenCalled();
  });

  it("closes the remote browser if context creation fails", async () => {
    mocks.browser.newContext.mockRejectedValue(
      new Error("context creation failed"),
    );
    await expect(
      captureReleaseScreenshot({
        gameId: "game",
        releaseId: "release",
        generationId: "generation",
      }),
    ).rejects.toThrow("context creation failed");
    expect(mocks.browser.close).toHaveBeenCalledOnce();
    expect(mocks.putObject).not.toHaveBeenCalled();
  });
});
