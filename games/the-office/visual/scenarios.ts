import type {
  VisualScenarioContext,
  VisualScenarioPack,
} from "@air-jam/visual-harness";
import {
  captureStandardSurfaces,
  defineVisualHarness,
  waitForControllerText,
  waitForHostText,
} from "@air-jam/visual-harness";
import { theOfficeVisualHarnessBridge } from "./contract";

const prepareLobbyState = async (
  context: VisualScenarioContext<typeof theOfficeVisualHarnessBridge>,
): Promise<void> => {
  await waitForHostText(context, /Controller link|Waiting for controllers/i);
  await context.ensureControllerInteractive();

  await context.controller.game.getByRole("button", { name: "Špela" }).click();

  await waitForHostText(context, "Špela", 20_000);
  await context.controller.game
    .getByRole("button", { name: "Start Match" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await context.host.game
    .getByRole("button", { name: "Start Match" })
    .waitFor({ state: "visible", timeout: 20_000 });
  await context.sleep(500);
};

const preparePlayingState = async (
  context: VisualScenarioContext<typeof theOfficeVisualHarnessBridge>,
): Promise<void> => {
  await prepareLobbyState(context);
  await context.bridge.actions.startMatch();
  await context.bridge.waitFor(
    (snapshot) => snapshot?.matchPhase === "playing",
    'host match phase "playing"',
    10_000,
  );
  await waitForControllerText(context, /Energy|Energija/i, 20_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  gameId: "the-office",
  bridge: theOfficeVisualHarnessBridge,
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one controller joined, one character selected, and ready state visible.",
      run: async (
        context: VisualScenarioContext<typeof theOfficeVisualHarnessBridge>,
      ) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Playing surface after one controller selects a character, readies up, and the host starts the match.",
      run: async (
        context: VisualScenarioContext<typeof theOfficeVisualHarnessBridge>,
      ) => {
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
      run: async (
        context: VisualScenarioContext<typeof theOfficeVisualHarnessBridge>,
      ) => {
        await preparePlayingState(context);
        await context.bridge.actions.forceEndMatch();
        await waitForHostText(context, "Shift Ended", 10_000);
        await waitForControllerText(context, "Shift Ended", 10_000);
        await context.sleep(750);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<typeof theOfficeVisualHarnessBridge>;
