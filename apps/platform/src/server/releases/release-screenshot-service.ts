import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import { getReleaseModerationConfig } from "@/server/releases/release-moderation-config";
import { getReleaseStorage } from "@/server/releases/release-storage";
import { buildReleaseScreenshotObjectKey } from "@/server/releases/release-storage-keys";
import { RELEASE_INSPECTION_ACCESS_HEADER } from "./release-inspection-access";
import { chromium } from "playwright-core";

export type ReleaseScreenshotCaptureResult = {
  screenshotObjectKey: string;
  contentType: "image/png";
  sizeBytes: number;
  width: number;
  height: number;
};

export const captureReleaseScreenshot = async ({
  gameId,
  releaseId,
  entryPath,
}: {
  gameId: string;
  releaseId: string;
  entryPath: string;
}): Promise<ReleaseScreenshotCaptureResult> => {
  const config = getReleaseModerationConfig();
  const storage = getReleaseStorage();
  const targetUrl = buildHostedReleaseAssetUrl({
    gameId,
    releaseId,
    assetPath: entryPath,
  });

  const browser = config.browserLaunch.wsEndpoint
    ? await chromium.connect(config.browserLaunch.wsEndpoint)
    : await chromium.launch({
        headless: true,
        executablePath: config.browserLaunch.executablePath ?? undefined,
      });

  try {
    const context = await browser.newContext({
      viewport: {
        width: config.browserLaunch.viewportWidth,
        height: config.browserLaunch.viewportHeight,
      },
      extraHTTPHeaders: {
        [RELEASE_INSPECTION_ACCESS_HEADER]: config.internalAccessToken,
      },
    });

    try {
      const page = await context.newPage();
      await page.goto(targetUrl, {
        waitUntil: "networkidle",
        timeout: config.browserLaunch.navigationTimeoutMs,
      });
      if (config.browserLaunch.waitAfterLoadMs > 0) {
        await page.waitForTimeout(config.browserLaunch.waitAfterLoadMs);
      }

      const screenshot = await page.screenshot({
        type: "png",
        fullPage: true,
      });
      const screenshotObjectKey = buildReleaseScreenshotObjectKey({
        gameId,
        releaseId,
      });

      await storage.putObject({
        key: screenshotObjectKey,
        body: screenshot,
        contentType: "image/png",
        cacheControl: "no-store",
      });

      return {
        screenshotObjectKey,
        contentType: "image/png",
        sizeBytes: screenshot.byteLength,
        width: config.browserLaunch.viewportWidth,
        height: config.browserLaunch.viewportHeight,
      };
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
};
