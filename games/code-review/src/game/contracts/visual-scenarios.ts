import type {
  VisualScenarioContext,
  VisualScenarioPack,
} from "@air-jam/harness/visual";
import {
  captureStandardSurfaces,
  defineVisualHarness,
  waitForControllerText,
  waitForHostText,
} from "@air-jam/harness/visual";
import { agentContract } from "./agent";

type CodeReviewVisualContext = VisualScenarioContext<typeof agentContract>;

const prepareLobbyState = async (
  context: CodeReviewVisualContext,
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
  context: CodeReviewVisualContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.host.game.getByRole("button", { name: "Play" }).click();
  await waitForControllerText(context, "Guard", 20_000);

  for (let index = 0; index < 5; index += 1) {
    await context.agent.invoke("player:award_point", "team1");
  }

  for (let index = 0; index < 2; index += 1) {
    await context.agent.invoke("player:award_point", "team2");
  }

  await waitForHostText(context, "Match Ended", 10_000);
  await waitForControllerText(context, "Match Ended", 10_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  agent: agentContract,
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one human on Coder, one reviewer bot, and pong-style staffing rules.",
      run: async (context) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Active match after one controller joins Coder, adds a reviewer bot, and the host starts the match.",
      run: async (context) => {
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
        "Ended match after canonical agent actions deterministically drive the score to 5:2 and finish the match.",
      run: async (context) => {
        await prepareEndedState(context);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<typeof agentContract>;
