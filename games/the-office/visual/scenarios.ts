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
  await waitForHostText(context, /Controller link|Waiting for controllers/i);
  await context.ensureControllerInteractive();

  await context.controller.game.getByRole("button", { name: "Špela" }).click();
  await context.controller.game
    .getByRole("button", { name: "Ready" })
    .click();

  await waitForHostText(context, "Špela", 20_000);
  await context.host.game
    .getByRole("button", { name: "Start Match" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await context.sleep(500);
};

const preparePlayingState = async (
  context: VisualScenarioContext,
): Promise<void> => {
  await prepareLobbyState(context);
  await context.host.game.getByRole("button", { name: "Start Match" }).click();
  await waitForControllerText(context, "Energija", 20_000);
  await context.sleep(750);
};

export const visualHarness = {
  gameId: "the-office",
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one controller joined, one character selected, and ready state visible.",
      run: async (context) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Playing surface after one controller selects a character, readies up, and the host starts the match.",
      run: async (context) => {
        await preparePlayingState(context);
        await captureStandardSurfaces(context, {
          controllerOrientation: "landscape",
        });
      },
    },
    {
      id: "ended",
      description:
        "Ended surface after the host force-finishes a deterministic match through the visual harness bridge.",
      run: async (context) => {
        await preparePlayingState(context);
        await context.invokeHostBridgeAction("forceEndMatch");
        await waitForHostText(context, "Shift Ended", 10_000);
        await waitForControllerText(context, "Shift Ended", 10_000);
        await context.sleep(750);
        await captureStandardSurfaces(context);
      },
    },
  ],
} satisfies VisualScenarioPack;
