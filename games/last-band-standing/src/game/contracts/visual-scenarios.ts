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
import { lastBandStandingVisualHarnessBridge } from "./visual-bridge";

type LastBandStandingVisualContext = VisualScenarioContext<
  typeof agentContract,
  typeof lastBandStandingVisualHarnessBridge
>;

const prepareLobbyState = async (
  context: LastBandStandingVisualContext,
): Promise<void> => {
  await waitForHostText(context, /Open the QR overlay to join|More friends\?/i);
  await context.ensureControllerInteractive();

  const nameField = context.controller.game.locator("#player-name");
  await nameField.fill("Visual Runner");
  await context.controller.game.getByRole("button", { name: /Ready/i }).click();

  await waitForHostText(context, /1\/1 ready|All players ready!/i, 20_000);
  await context.sleep(500);
};

const preparePlayingState = async (
  context: LastBandStandingVisualContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.host.game.getByRole("button", { name: "Start Match" }).click();

  await context.agent.waitFor(
    (snapshot) => snapshot.phase === "round-active",
    'agent snapshot phase "round-active"',
    10_000,
  );
  await waitForControllerText(context, /Round 1\//i, 10_000);
  await context.sleep(750);
};

const prepareEndedState = async (
  context: LastBandStandingVisualContext,
): Promise<void> => {
  await preparePlayingState(context);

  await context.agent.invoke("host:force_game_over");
  await context.agent.waitFor(
    (snapshot) => snapshot.phase === "game-over",
    'agent snapshot phase "game-over"',
    10_000,
  );
  await waitForControllerText(context, /Your Placement/i, 10_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  agent: agentContract,
  bridge: lastBandStandingVisualHarnessBridge,
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one joined controller, a valid player name, and ready state visible on the host and controller shells.",
      run: async (context) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "First round playing state after one controller joins, enters a valid name, readies up, and the host starts the match.",
      run: async (context) => {
        await preparePlayingState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "ended",
      description:
        "Game-over state after a canonical host semantic action finalizes the match deterministically.",
      run: async (context) => {
        await prepareEndedState(context);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<
  typeof agentContract,
  typeof lastBandStandingVisualHarnessBridge
>;
