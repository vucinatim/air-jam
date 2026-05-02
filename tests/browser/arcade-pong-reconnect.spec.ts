import { expect, test, type Locator } from "@playwright/test";
import { dismissControllerFullscreenPrompt } from "./helpers/controller-fullscreen";
import { resolveControllerJoinUrl } from "./helpers/controller-join-url";

const joinTeamUntilAssigned = async (joinTeamButton: Locator) => {
  await expect(async () => {
    await joinTeamButton.click();
    await expect(joinTeamButton).toHaveText("Joined");
  }).toPass({ timeout: 20_000 });
};

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
  if (!baseURL) {
    throw new Error("Playwright baseURL was not configured.");
  }
  const controllerJoinUrl = await resolveControllerJoinUrl({
    hostGame,
    baseURL,
  });

  let controllerPage = await context.newPage();
  await controllerPage.goto(controllerJoinUrl);
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
  await joinTeamUntilAssigned(joinTeamButton);
  await expect(
    hostGame.getByTestId("pong-host-team-slot-team1-0"),
  ).not.toContainText("Open Slot");

  await controllerPage.close();
  await expect(
    hostGame.getByTestId("pong-host-team-slot-team1-0"),
  ).not.toContainText("Open Slot");

  controllerPage = await context.newPage();
  await controllerPage.goto(controllerJoinUrl);
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
