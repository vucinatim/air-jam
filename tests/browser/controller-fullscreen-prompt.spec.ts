import { expect, test } from "@playwright/test";

test("controller page prompts for fullscreen when opened from a room link", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const hostPage = await context.newPage();

  await hostPage.goto(`${baseURL}/arcade/local-pong`);
  const hostGame = hostPage.frameLocator(
    'iframe[data-testid="arcade-host-game-frame"]',
  );
  await expect(hostGame.getByTestId("pong-host-room-code")).toHaveText(
    /[A-Z0-9]{4}/,
  );

  const roomCode = (
    await hostGame.getByTestId("pong-host-room-code").textContent()
  )?.trim();
  if (!roomCode) {
    throw new Error("Pong room code was not available.");
  }

  const controllerPage = await context.newPage();
  await controllerPage.goto(
    `${baseURL}/controller?room=${encodeURIComponent(roomCode)}`,
  );

  await expect(
    controllerPage.getByTestId("controller-fullscreen-prompt"),
  ).toBeVisible();
  await controllerPage
    .getByTestId("controller-fullscreen-prompt-dismiss")
    .click();
  await expect(
    controllerPage.getByTestId("controller-fullscreen-prompt"),
  ).toBeHidden();

  const controllerGame = controllerPage.frameLocator(
    'iframe[data-testid="arcade-controller-game-frame"]',
  );
  await expect(
    controllerGame.getByTestId("pong-controller-lobby-panel"),
  ).toBeVisible();
});
