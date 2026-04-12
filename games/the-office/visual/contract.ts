import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/visual-harness/runtime";

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
    forceEndMatch: bridgeAction.custom(
      (context: {
        matchPhase: string | null;
        storeActions: {
          finishMatch: () => void;
        };
      }) => {
        if (context.matchPhase !== "playing") {
          throw new Error(
            "[visual-harness:the-office.forceEndMatch] can only run during the playing phase",
          );
        }

        context.storeActions.finishMatch();
      },
    ),
  },
});
