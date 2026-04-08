import type {
  VisualScenarioContext,
  VisualScenarioPack,
} from "@air-jam/visual-harness";
import {
  captureStandardSurfaces,
  waitForControllerText,
  waitForHostText,
} from "@air-jam/visual-harness";

const prepareLobbyState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await waitForHostText(context, "Connected Players");
  await context.ensureControllerInteractive();
  await context.controller.game.getByRole("button", { name: "CODER" }).click();
  await context.controller.game.getByRole("button", { name: "+" }).nth(1).click();
  await context.controller.game
    .getByRole("button", { name: "TAP TO READY" })
    .click();

  await waitForHostText(context, /Ready Humans 1\/1/, 20_000);
  await context.sleep(500);
};

const prepareEndedState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.host.game.getByRole("button", { name: "Play" }).click();
  await waitForControllerText(context, "DEFEND", 20_000);

  await context.invokeHostBridgeAction("forceEndMatch", {
    scores: { team1: 5, team2: 2 },
  });

  await waitForHostText(context, "Match Ended", 10_000);
  await waitForControllerText(context, "Match Ended", 10_000);
  await context.sleep(750);
};

export const visualHarness = {
  gameId: "code-review",
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one joined human, one reviewer bot, and ready-gated start state.",
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
        "Active match after one controller joins team one, adds a reviewer bot, readies up, and the host starts the match.",
      run: async (context) => {
        await prepareLobbyState(context);
        await context.host.game.getByRole("button", { name: "Play" }).click();
        await waitForControllerText(context, "DEFEND", 20_000);
        await context.sleep(750);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "ended",
      description:
        "Ended match after a deterministic dev-only host bridge finalizes the score and match summary.",
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
