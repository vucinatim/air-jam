import { HOSTED_RELEASE_HOST_PATH } from "@/lib/releases/hosted-release-artifact";
import { getReleaseModerationConfig } from "@/server/releases/release-moderation-config";
import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import { getReleaseStorage } from "@/server/releases/release-storage";
import { buildReleaseGenerationScreenshotObjectKey } from "@/server/releases/release-storage-keys";
import { openCloudflareBrowserSession } from "./cloudflare-browser-session";
import { createReleaseInspectionAccessToken } from "./release-inspection-access";
import { installReleaseInspectionRouting } from "./release-inspection-routing";

const CAPTURE_TIMEOUT_MS = 90_000;
const CLEANUP_TIMEOUT_MS = 5_000;
const MAX_SCREENSHOT_BYTES = 16 * 1024 * 1024;

export type ReleaseScreenshotCaptureResult = {
  generationId: string;
  captureId: string;
  screenshotObjectKey: string;
  contentType: "image/png";
  sizeBytes: number;
  width: number;
  height: number;
};

export const captureReleaseScreenshot = async ({
  gameId,
  releaseId,
  generationId,
  captureId: requestedCaptureId,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  captureId?: string;
}): Promise<ReleaseScreenshotCaptureResult> => {
  const config = getReleaseModerationConfig();
  const captureDeadline = Date.now() + CAPTURE_TIMEOUT_MS;
  const storage = getReleaseStorage();
  const targetUrl = buildHostedReleaseAssetUrl({
    gameId,
    releaseId,
    generationId,
    assetPath: HOSTED_RELEASE_HOST_PATH,
  });
  const inspectionAccessToken = createReleaseInspectionAccessToken({
    gameId,
    releaseId,
    generationId,
    secret: config.internalAccessSecret,
    expiresAtMs: captureDeadline,
  });

  const browserSession = await openCloudflareBrowserSession({
    accountId: config.browser.accountId,
    apiToken: config.browser.apiToken,
    timeoutMs: config.browser.navigationTimeoutMs,
  });
  const { browser } = browserSession;

  let captureTimer: ReturnType<typeof setTimeout> | undefined;
  let screenshot: Buffer;
  try {
    const capture = async () => {
      const context = await browser.newContext({
        serviceWorkers: "block",
        acceptDownloads: false,
        viewport: {
          width: config.browser.viewportWidth,
          height: config.browser.viewportHeight,
        },
      });
      await installReleaseInspectionRouting(context, {
        generationUrl: buildHostedReleaseAssetUrl({
          gameId,
          releaseId,
          generationId,
          assetPath: "",
        }),
        token: inspectionAccessToken,
        requestTimeoutMs: config.browser.navigationTimeoutMs,
      });
      const page = await context.newPage();
      // A capture owns one top-level page; game iframes remain unaffected.
      context.on("page", (popup) => {
        if (popup !== page) void popup.close().catch(() => undefined);
      });
      const hostResponse = await page.goto(targetUrl, {
        waitUntil: "load",
        timeout: config.browser.navigationTimeoutMs,
      });
      if (!hostResponse) {
        throw new Error(
          "Release screenshot host did not return an HTTP response.",
        );
      }
      if (!hostResponse.ok()) {
        throw new Error(
          `Release screenshot host returned HTTP ${hostResponse.status()}.`,
        );
      }
      if (config.browser.waitAfterLoadMs > 0) {
        await page.waitForTimeout(config.browser.waitAfterLoadMs);
      }

      return page.screenshot({
        type: "png",
        fullPage: false,
        timeout: config.browser.navigationTimeoutMs,
      });
    };
    screenshot = await Promise.race([
      capture(),
      new Promise<never>((_, reject) => {
        captureTimer = setTimeout(
          () =>
            reject(
              new Error(
                "Release screenshot capture exceeded its 90-second deadline.",
              ),
            ),
          Math.max(0, captureDeadline - Date.now()),
        );
      }),
    ]);
  } finally {
    clearTimeout(captureTimer);
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Closing the connection also cancels any pending page/context operation.
      await Promise.race([
        browserSession.close(),
        new Promise<never>((_, reject) => {
          cleanupTimer = setTimeout(
            () =>
              reject(
                new Error("Release screenshot browser cleanup timed out."),
              ),
            CLEANUP_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      clearTimeout(cleanupTimer);
    }
  }

  if (screenshot.byteLength > MAX_SCREENSHOT_BYTES) {
    throw new Error("Release screenshot exceeds the 16 MiB output limit.");
  }
  const captureId = requestedCaptureId?.trim() || crypto.randomUUID();
  const screenshotObjectKey = buildReleaseGenerationScreenshotObjectKey({
    gameId,
    releaseId,
    generationId,
    captureId,
  });
  await storage.putObject({
    key: screenshotObjectKey,
    body: screenshot,
    contentType: "image/png",
    cacheControl: "no-store",
    writeMode: "create",
  });
  return {
    generationId,
    captureId,
    screenshotObjectKey,
    contentType: "image/png",
    sizeBytes: screenshot.byteLength,
    width: config.browser.viewportWidth,
    height: config.browser.viewportHeight,
  };
};
