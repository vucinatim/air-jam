import type {
  VisualScenarioContext,
  VisualScenarioPack,
} from "@air-jam/visual-harness";
import {
  captureStandardSurfaces,
  waitForControllerText,
  waitForHostMatchPhase,
  waitForHostText,
} from "@air-jam/visual-harness";

const prepareLobbyState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await waitForHostText(context, "Join On Phone");
  await context.ensureControllerInteractive();

  await context.controller.game
    .getByTestId("pong-controller-join-team-team1")
    .click();

  await context.host.game
    .locator('[data-testid="pong-host-team-card-team1"]')
    .getByText("1/2 Ready")
    .waitFor({ state: "visible", timeout: 20_000 });

  await context.sleep(500);
};

const preparePlayingState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.controller.game
    .getByTestId("pong-controller-add-bot-team2")
    .click();

  await context.host.game
    .getByRole("button", { name: "Play" })
    .click();

  await waitForControllerText(context, "Active Paddle", 20_000);
  await context.sleep(750);
};

const prepareEndedState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.invokeHostBridgeAction("setPointsToWin", 1);

  await context.controller.game
    .getByTestId("pong-controller-add-bot-team2")
    .click();

  await context.host.game
    .getByRole("button", { name: "Play" })
    .click();

  await waitForHostMatchPhase(context, "playing", 10_000);
  await context.invokeHostBridgeAction("scorePoint", "team1");
  await waitForHostMatchPhase(context, "ended", 10_000);
  await waitForControllerText(context, "Match Ended", 10_000);
  await context.sleep(750);
};

export const visualHarness = {
  gameId: "pong",
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one joined controller staged on team one and standard host/controller shell captures.",
      run: async (context) => {
        if (context.controller.fullscreenPromptDismissed) {
          context.note("Dismissed controller fullscreen prompt before capture.");
        }

        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Playing surface after one controller joins team one, a bot is added to team two, and the host starts the match.",
      run: async (context) => {
        if (context.controller.fullscreenPromptDismissed) {
          context.note("Dismissed controller fullscreen prompt before capture.");
        }

        await preparePlayingState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "ended",
      description:
        "Ended surface after a deterministic one-point match where the host awards the winning point through the visual harness bridge.",
      run: async (context) => {
        if (context.controller.fullscreenPromptDismissed) {
          context.note("Dismissed controller fullscreen prompt before capture.");
        }

        await prepareEndedState(context);
        await captureStandardSurfaces(context);
      },
    },
  ],
} satisfies VisualScenarioPack;
