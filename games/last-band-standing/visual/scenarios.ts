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
  await waitForHostText(context, "More friends? Scan to join");
  await context.ensureControllerInteractive();

  const nameField = context.controller.game.locator("#player-name");
  await nameField.fill("Visual Runner");
  await context.controller.game.getByRole("button", { name: /Ready/i }).click();

  await waitForHostText(context, /1\/1 ready|All players ready!/i, 20_000);
  await context.sleep(500);
};

const preparePlayingState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.host.game
    .getByRole("button", { name: "Start Match" })
    .click();

  await waitForHostMatchPhase(context, "playing", 10_000);
  await waitForControllerText(context, /Round 1\//i, 10_000);
  await context.sleep(750);
};

const prepareEndedState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await preparePlayingState(context);

  await context.invokeHostBridgeAction("forceGameOver");
  await waitForHostMatchPhase(context, "ended", 10_000);
  await waitForControllerText(context, /Your Placement/i, 10_000);
  await context.sleep(750);
};

export const visualHarness = {
  gameId: "last-band-standing",
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one joined controller, a valid player name, and ready state visible on the host and controller shells.",
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
        "First round playing state after one controller joins, enters a valid name, readies up, and the host starts the match.",
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
        "Game-over state after the host uses a dev-only harness bridge action to finalize the match deterministically.",
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
