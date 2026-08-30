import { expect, test } from "@playwright/test";
import { dismissControllerFullscreenPrompt } from "./helpers/controller-fullscreen";
import { resolveControllerJoinUrl } from "./helpers/controller-join-url";
import { getHostGameFrame, openArcadeHost } from "./helpers/open-arcade-host";

const PLATFORM_COOKIE_NAME = "airjam_platform_boundary_proof";
const PLATFORM_STORAGE_KEY = "airjam_platform_storage_boundary_proof";
const HOST_FRAME_SELECTOR = 'iframe[data-testid="arcade-host-game-frame"]';
const CONTROLLER_FRAME_SELECTOR =
  'iframe[data-testid="arcade-controller-game-frame"]';

const expectContainedSandbox = async (sandbox: string | null) => {
  const sandboxTokens = new Set((sandbox ?? "").split(/\s+/).filter(Boolean));
  expect(sandboxTokens).toContain("allow-scripts");
  expect(sandboxTokens).toContain("allow-same-origin");
  expect(sandboxTokens).toContain("allow-popups");
  expect(sandboxTokens).not.toContain("allow-top-navigation");
  expect(sandboxTokens).not.toContain(
    "allow-top-navigation-by-user-activation",
  );
  expect(sandboxTokens).not.toContain("allow-popups-to-escape-sandbox");
};

test("hosted game sandbox contains a hostile distinct-origin release while preserving the bridge", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL was not configured.");
  }

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: PLATFORM_COOKIE_NAME,
      value: "platform-secret",
      url: baseURL,
      sameSite: "Lax",
    },
  ]);

  const page = await context.newPage();
  await page.goto(baseURL);
  await page.evaluate(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: PLATFORM_STORAGE_KEY, value: "platform-secret" },
  );
  await expect
    .poll(() =>
      page.evaluate(
        (key) => window.localStorage.getItem(key),
        PLATFORM_STORAGE_KEY,
      ),
    )
    .toBe("platform-secret");

  const hostileApiRequestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.origin === new URL(baseURL).origin &&
      url.pathname === "/api/health" &&
      url.searchParams.get("hostile_boundary_proof") === "1"
    );
  });
  await openArcadeHost({
    page,
    baseURL,
    path: "/arcade/local-code-review",
    readyTestId: "hostile-fixture-ready",
  });

  const hostFrameElement = page.locator(HOST_FRAME_SELECTOR);
  await expectContainedSandbox(await hostFrameElement.getAttribute("sandbox"));

  const platformOrigin = new URL(baseURL).origin;
  const hostileFrame = getHostGameFrame(page);
  await expect(hostileFrame.getByTestId("fixture-origin")).not.toHaveText(
    platformOrigin,
  );
  await expect(hostileFrame.getByTestId("platform-cookie-access")).toHaveText(
    "denied",
  );
  await expect(hostileFrame.getByTestId("platform-storage-access")).toHaveText(
    "denied",
  );
  await expect(hostileFrame.getByTestId("parent-dom-access")).toHaveText(
    "denied",
  );
  await expect(hostileFrame.getByTestId("platform-api-access")).toHaveText(
    "blocked",
  );
  const hostileApiRequest = await hostileApiRequestPromise;
  const hostileApiCookieHeader =
    (await hostileApiRequest.headerValue("cookie")) ?? "";
  expect(hostileApiCookieHeader).not.toContain(`${PLATFORM_COOKIE_NAME}=`);
  await expect(hostileFrame.getByTestId("top-navigation")).toHaveText(
    "blocked",
  );
  await expect(page).toHaveURL(/\/arcade\/local-code-review/);

  // The supported, origin-checked settings bridge remains available even
  // while ambient DOM and cookie authority are unavailable to the game.
  await expect(hostileFrame.getByTestId("settings-bridge")).toHaveText(
    "connected",
  );

  const popupPromise = page.waitForEvent("popup");
  await hostileFrame.getByTestId("attempt-popup-escape").click();
  const popup = await popupPromise;
  await expect(hostileFrame.getByTestId("popup-top-navigation")).toHaveText(
    "blocked",
  );
  await expect(page).toHaveURL(/\/arcade\/local-code-review/);
  await expect.poll(() => popup.isClosed()).toBe(true);

  await popup.close().catch(() => undefined);
  await context.close();
});

test("host and controller happy path share the contained iframe policy", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) {
    throw new Error("Playwright baseURL was not configured.");
  }

  const context = await browser.newContext();
  const hostPage = await context.newPage();
  const hostGame = await openArcadeHost({
    page: hostPage,
    baseURL,
    path: "/arcade/local-pong",
    readyTestId: "pong-host-lobby-screen",
  });
  await expectContainedSandbox(
    await hostPage.locator(HOST_FRAME_SELECTOR).getAttribute("sandbox"),
  );

  const controllerJoinUrl = await resolveControllerJoinUrl({
    hostGame,
    baseURL,
  });
  const controllerPage = await context.newPage();
  await controllerPage.goto(controllerJoinUrl);
  await dismissControllerFullscreenPrompt(controllerPage);

  const controllerFrameElement = controllerPage.locator(
    CONTROLLER_FRAME_SELECTOR,
  );
  await expect(controllerFrameElement).toBeVisible();
  await expectContainedSandbox(
    await controllerFrameElement.getAttribute("sandbox"),
  );
  await expect(
    controllerPage
      .frameLocator(CONTROLLER_FRAME_SELECTOR)
      .getByTestId("pong-controller-lobby-panel"),
  ).toBeVisible();

  await context.close();
});
