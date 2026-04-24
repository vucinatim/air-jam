import type {
  VisualScenarioContext,
  VisualScenarioPack,
} from "@air-jam/harness";
import {
  captureStandardSurfaces,
  defineVisualHarness,
  waitForControllerText,
  waitForHostText,
} from "@air-jam/harness";
import { codeReviewVisualHarnessBridge } from "./contract";

const prepareLobbyState = async (
  context: VisualScenarioContext<typeof codeReviewVisualHarnessBridge>,
): Promise<void> => {
  await waitForHostText(context, "Connected Players");
  await context.ensureControllerInteractive();
  await context.controller.game
    .getByTestId("code-review-controller-join-team-team1")
    .click();
  await context.controller.game
    .getByTestId("code-review-controller-add-bot-team2")
    .click();

  await context.controller.game
    .getByText(/Ready\. First to/i)
    .waitFor({ state: "visible", timeout: 20_000 });

  await context.sleep(500);
};

const prepareEndedState = async (
  context: VisualScenarioContext<typeof codeReviewVisualHarnessBridge>,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.host.game.getByRole("button", { name: "Play" }).click();
  await waitForControllerText(context, "Guard", 20_000);

  await context.bridge.actions.forceEndMatch({
    scores: { team1: 5, team2: 2 },
  });

  await waitForHostText(context, "Match Ended", 10_000);
  await waitForControllerText(context, "Match Ended", 10_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  gameId: "code-review",
  bridge: codeReviewVisualHarnessBridge,
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one human on Coder, one reviewer bot, and pong-style staffing rules.",
      run: async (
        context: VisualScenarioContext<typeof codeReviewVisualHarnessBridge>,
      ) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Active match after one controller joins Coder, adds a reviewer bot, and the host starts the match.",
      run: async (
        context: VisualScenarioContext<typeof codeReviewVisualHarnessBridge>,
      ) => {
        await prepareLobbyState(context);
        await context.host.game.getByRole("button", { name: "Play" }).click();
        await waitForControllerText(context, "Guard", 20_000);
        await context.sleep(750);
        await captureStandardSurfaces(context, {
          controllerOrientation: "landscape",
        });
      },
    },
    {
      id: "ended",
      description:
        "Ended match after a deterministic dev-only host bridge finalizes the score and match summary.",
      run: async (
        context: VisualScenarioContext<typeof codeReviewVisualHarnessBridge>,
      ) => {
        await prepareEndedState(context);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<typeof codeReviewVisualHarnessBridge>;
