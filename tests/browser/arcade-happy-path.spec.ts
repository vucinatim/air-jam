import { expect, test } from "@playwright/test";

test("arcade local pong host and controller complete the happy path", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const hostPage = await context.newPage();

  await hostPage.goto(`${baseURL}/arcade/local-pong`);
  await expect(hostPage.getByTestId("arcade-room-code")).toHaveText(/[A-Z0-9]{4}/);

  const roomCode = (await hostPage.getByTestId("arcade-room-code").textContent())?.trim();
  if (!roomCode) {
    throw new Error("Arcade room code was not available.");
  }

  const hostGame = hostPage.frameLocator('iframe[data-testid="arcade-host-game-frame"]');
  await expect(hostGame.getByTestId("pong-host-lobby-screen")).toBeVisible();

  const controllerPage = await context.newPage();
  await controllerPage.goto(`${baseURL}/controller?room=${encodeURIComponent(roomCode)}`);

  const controllerGame = controllerPage.frameLocator(
    'iframe[data-testid="arcade-controller-game-frame"]',
  );
  await expect(controllerGame.getByTestId("pong-controller-lobby-panel")).toBeVisible();

  await controllerGame.getByTestId("pong-controller-join-team-team1").click();
  await expect(hostGame.getByTestId("pong-host-team-slot-team1-0")).toContainText(
    "Player",
  );

  await controllerGame.getByTestId("pong-controller-add-bot-team2").click();
  await controllerGame.getByTestId("pong-controller-start-match").click();

  await expect(controllerGame.getByTestId("pong-controller-playing-controls")).toBeVisible();
  await expect(hostGame.getByTestId("pong-host-score-strip")).toBeVisible();
});
