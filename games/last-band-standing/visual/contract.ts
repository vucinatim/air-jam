import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/visual-harness/runtime";

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
      (context: {
        actions: {
          forceGameOver: () => void;
        };
      }) => {
        context.actions.forceGameOver();
      },
    ),
  },
});
