import { expect, test } from "@playwright/test";
import { dismissControllerFullscreenPrompt } from "./helpers/controller-fullscreen";

test("arcade local pong resumes the same controller slot after controller refresh", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const hostPage = await context.newPage();

  await hostPage.goto(`${baseURL}/arcade/local-pong`);
  const hostGame = hostPage.frameLocator(
    'iframe[data-testid="arcade-host-game-frame"]',
  );
  await expect(hostGame.getByTestId("pong-host-lobby-screen")).toBeVisible();

  await expect(hostGame.getByTestId("pong-host-room-code")).toHaveText(
    /[A-Z0-9]{4}/,
  );
  const roomCode = (
    await hostGame.getByTestId("pong-host-room-code").textContent()
  )?.trim();
  if (!roomCode) {
    throw new Error("Pong room code was not available.");
  }

  let controllerPage = await context.newPage();
  await controllerPage.goto(
    `${baseURL}/controller?room=${encodeURIComponent(roomCode)}`,
  );
  await dismissControllerFullscreenPrompt(controllerPage);

  let controllerGame = controllerPage.frameLocator(
    'iframe[data-testid="arcade-controller-game-frame"]',
  );
  await expect(
    controllerGame.getByTestId("pong-controller-lobby-panel"),
  ).toBeVisible();

  const joinTeamButton = controllerGame.getByTestId(
    "pong-controller-join-team-team1",
  );
  await joinTeamButton.click();
  await expect(joinTeamButton).toHaveText("Joined");
  await expect(
    hostGame.getByTestId("pong-host-team-slot-team1-0"),
  ).not.toContainText("Open Slot");

  await controllerPage.close();
  await expect(
    hostGame.getByTestId("pong-host-team-slot-team1-0"),
  ).not.toContainText("Open Slot");

  controllerPage = await context.newPage();
  await controllerPage.goto(
    `${baseURL}/controller?room=${encodeURIComponent(roomCode)}`,
  );
  await dismissControllerFullscreenPrompt(controllerPage);
  controllerGame = controllerPage.frameLocator(
    'iframe[data-testid="arcade-controller-game-frame"]',
  );

  const resumedJoinButton = controllerGame.getByTestId(
    "pong-controller-join-team-team1",
  );
  await expect(resumedJoinButton).toHaveText("Joined");
  await expect(
    hostGame.getByTestId("pong-host-team-slot-team1-0"),
  ).not.toContainText("Open Slot");

  await controllerGame.getByTestId("pong-controller-add-bot-team2").click();
  await controllerGame.getByTestId("pong-controller-start-match").click();

  await expect(
    controllerGame.getByTestId("pong-controller-playing-controls"),
  ).toBeVisible();
  await expect(hostGame.getByTestId("pong-host-score-strip")).toBeVisible();
});
