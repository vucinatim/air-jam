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
import { theOfficeVisualHarnessBridge } from "./visual-bridge";

type TheOfficeVisualContext = VisualScenarioContext<
  typeof agentContract,
  typeof theOfficeVisualHarnessBridge
>;

const prepareLobbyState = async (
  context: TheOfficeVisualContext,
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
  context: TheOfficeVisualContext,
): Promise<void> => {
  await prepareLobbyState(context);
  await context.agent.invoke("player:start_match");
  await context.agent.waitFor(
    (snapshot) => snapshot.phase === "playing",
    'agent snapshot phase "playing"',
    10_000,
  );
  await waitForControllerText(context, /Energy|Energija/i, 20_000);
  await context.sleep(750);
};

export const visualHarness = defineVisualHarness({
  agent: agentContract,
  bridge: theOfficeVisualHarnessBridge,
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
        "Ended surface after a canonical host semantic action force-finishes a deterministic match.",
      run: async (context) => {
        await preparePlayingState(context);
        await context.agent.invoke("host:finish_match");
        await waitForHostText(context, "Shift Ended", 10_000);
        await waitForControllerText(context, "Shift Ended", 10_000);
        await context.sleep(750);
        await captureStandardSurfaces(context);
      },
    },
  ],
}) satisfies VisualScenarioPack<
  typeof agentContract,
  typeof theOfficeVisualHarnessBridge
>;
