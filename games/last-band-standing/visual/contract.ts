import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/harness/runtime";

export const lastBandStandingVisualHarnessBridge = defineVisualHarnessBridge({
  gameId: "last-band-standing",
  selectSnapshot: (context: {
    host: {
      roomId: string | null;
      joinUrl: string | null;
      joinUrlStatus: string;
    };
    matchPhase: string | null;
    runtimeState: string | null;
    actions: {
      forceGameOver: () => void;
      resetLobby: () => void;
    };
  }) => ({
    roomId: context.host.roomId,
    controllerJoinUrl:
      context.host.joinUrlStatus === "ready" && context.host.joinUrl
        ? context.host.joinUrl
        : null,
    matchPhase: context.matchPhase,
    runtimeState: context.runtimeState,
  }),
  actions: {
    forceGameOver: bridgeAction.custom(
      {
        description:
          "Finish the current match immediately and show the game-over screen.",
        resultDescription: "The host transitions to the game-over state.",
      },
      (context: {
        actions: {
          forceGameOver: () => void;
        };
      }) => {
        context.actions.forceGameOver();
      },
    ),
    returnToLobby: bridgeAction.custom(
      {
        description:
          "Reset the current session back to a fresh lobby without restarting dev.",
        resultDescription:
          "The host returns to the lobby and clears the active match state.",
      },
      (context: {
        actions: {
          resetLobby: () => void;
        };
      }) => {
        context.actions.resetLobby();
      },
    ),
  },
});
