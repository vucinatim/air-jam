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

type PongVisualContext = VisualScenarioContext<typeof agentContract>;

const prepareLobbyState = async (
  context: PongVisualContext,
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
  context: PongVisualContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.controller.game
    .getByTestId("pong-controller-add-bot-team2")
    .click();

  await context.host.game.getByRole("button", { name: "Play" }).click();

  await waitForControllerText(context, "Active Paddle", 20_000);
  await context.sleep(750);
};

const prepareEndedState = async (
  context: PongVisualContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.agent.invoke("player:set_points_to_win", 1);

  await context.controller.game
    .getByTestId("pong-controller-add-bot-team2")
    .click();

  await context.host.game.getByRole("button", { name: "Play" }).click();

  await context.agent.waitFor(
    (snapshot) => snapshot.matchPhase === "playing",
    'agent snapshot match phase "playing"',
    10_000,
  );
  await context.agent.invoke("player:award_point", "team1");
  await context.agent.waitFor(
    (snapshot) => snapshot.matchPhase === "ended",
    'agent snapshot match phase "ended"',
    10_000,
  );
  await waitForControllerText(context, "Match Ended", 10_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  agent: agentContract,
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one joined controller staged on team one and standard host/controller shell captures.",
      run: async (context) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Playing surface after one controller joins team one, a bot is added to team two, and the host starts the match.",
      run: async (context) => {
        await preparePlayingState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "ended",
      description:
        "Ended surface after a deterministic one-point match where the visual scenario stages the finish through canonical agent actions.",
      run: async (context) => {
        await prepareEndedState(context);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<typeof agentContract>;
