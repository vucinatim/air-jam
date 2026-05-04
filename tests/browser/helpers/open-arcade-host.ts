import { expect, type FrameLocator, type Page } from "@playwright/test";

const HOST_FRAME_SELECTOR = 'iframe[data-testid="arcade-host-game-frame"]';
const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
const DEFAULT_READY_TIMEOUT_MS = 20_000;

interface OpenArcadeHostOptions {
  page: Page;
  baseURL: string | undefined;
  path: string;
  readyTestId: string;
  navigationTimeoutMs?: number;
  readyTimeoutMs?: number;
}

export const getHostGameFrame = (page: Page): FrameLocator =>
  page.frameLocator(HOST_FRAME_SELECTOR);

export const openArcadeHost = async ({
  page,
  baseURL,
  path,
  readyTestId,
  navigationTimeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
}: OpenArcadeHostOptions): Promise<FrameLocator> => {
  if (!baseURL) {
    throw new Error("Playwright baseURL was not configured.");
  }

  const routeUrl = `${baseURL}${path}`;

  try {
    await page.goto(routeUrl, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeoutMs,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Arcade host route ${path} did not finish initial navigation within ${navigationTimeoutMs}ms. ${detail}`,
    );
  }

  const hostGame = getHostGameFrame(page);

  try {
    await expect(hostGame.getByTestId(readyTestId)).toBeVisible({
      timeout: readyTimeoutMs,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Arcade host route ${path} never exposed ready marker "${readyTestId}" within ${readyTimeoutMs}ms. ${detail}`,
    );
  }

  return hostGame;
};
