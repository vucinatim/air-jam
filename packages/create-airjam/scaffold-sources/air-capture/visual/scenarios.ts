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
import { airCaptureVisualHarnessBridge } from "./contract";

const prepareLobbyState = async (
  context: VisualScenarioContext<typeof airCaptureVisualHarnessBridge>,
): Promise<void> => {
  await waitForHostText(context, "Join Room");
  await context.ensureControllerInteractive();

  await context.controller.game
    .getByTestId("air-capture-controller-join-team-solaris")
    .click();

  await context.host.game
    .getByText(
      /Ready\. First to|Add players or bots to|Teams are incomplete\./i,
    )
    .waitFor({ state: "visible", timeout: 20_000 });

  await context.host.game
    .getByText(/Solaris/i)
    .waitFor({ state: "visible", timeout: 20_000 });

  await context.sleep(500);
};

const preparePlayingState = async (
  context: VisualScenarioContext<typeof airCaptureVisualHarnessBridge>,
): Promise<void> => {
  await prepareLobbyState(context);

  await context.controller.game
    .getByTestId("air-capture-controller-add-bot-nebulon")
    .click();

  await context.host.game.getByRole("button", { name: "Start Match" }).click();

  await context.bridge.waitFor(
    (snapshot) => snapshot?.matchPhase === "playing",
    'host match phase "playing"',
    10_000,
  );
  await waitForControllerText(context, /Flight stick/i, 10_000);
  await context.sleep(750);
};

const prepareEndedState = async (
  context: VisualScenarioContext<typeof airCaptureVisualHarnessBridge>,
): Promise<void> => {
  await preparePlayingState(context);

  await context.bridge.actions.endMatch({
    winner: "solaris",
    finalScores: {
      solaris: 1,
      nebulon: 0,
    },
  });

  await context.bridge.waitFor(
    (snapshot) => snapshot?.matchPhase === "ended",
    'host match phase "ended"',
    10_000,
  );
  await waitForControllerText(context, /Match Ended/i, 10_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  gameId: "air-capture",
  bridge: airCaptureVisualHarnessBridge,
  scenarios: [
    {
      id: "lobby",
      description:
        "Host lobby with one connected controller assigned to Solaris and standard host/controller shell captures.",
      run: async (
        context: VisualScenarioContext<typeof airCaptureVisualHarnessBridge>,
      ) => {
        await prepareLobbyState(context);
        await captureStandardSurfaces(context);
      },
    },
    {
      id: "playing",
      description:
        "Playing surface after one controller joins Solaris, a Nebulon bot is added, and the host starts the match.",
      run: async (
        context: VisualScenarioContext<typeof airCaptureVisualHarnessBridge>,
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
        "Ended surface after a deterministic host bridge action finalizes the match with Solaris winning 1:0.",
      run: async (
        context: VisualScenarioContext<typeof airCaptureVisualHarnessBridge>,
      ) => {
        await prepareEndedState(context);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<typeof airCaptureVisualHarnessBridge>;
