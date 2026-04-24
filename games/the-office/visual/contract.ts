import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/harness/runtime";

export const theOfficeVisualHarnessBridge = defineVisualHarnessBridge({
  gameId: "the-office",
  selectSnapshot: (context: {
    host: {
      roomId: string | null;
      joinUrl: string | null;
      joinUrlStatus: string;
    };
    matchPhase: string | null;
    runtimeState: string | null;
    storeActions: {
      startMatch: () => void;
      finishMatch: () => void;
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
    startMatch: bridgeAction.custom(
      {
        description: "Start the match from the lobby state.",
        resultDescription:
          "The host leaves the lobby and enters the active match flow.",
      },
      (context: {
        matchPhase: string | null;
        storeActions: {
          startMatch: () => void;
        };
      }) => {
        if (context.matchPhase !== "lobby") {
          throw new Error(
            "[harness:the-office.startMatch] can only run during the lobby phase",
          );
        }

        context.storeActions.startMatch();
      },
    ),
    forceEndMatch: bridgeAction.custom(
      {
        description: "Finish the active match immediately.",
        resultDescription: "The host transitions to the match end state.",
      },
      (context: {
        matchPhase: string | null;
        storeActions: {
          finishMatch: () => void;
        };
      }) => {
        if (context.matchPhase !== "playing") {
          throw new Error(
            "[harness:the-office.forceEndMatch] can only run during the playing phase",
          );
        }

        context.storeActions.finishMatch();
      },
    ),
  },
});
