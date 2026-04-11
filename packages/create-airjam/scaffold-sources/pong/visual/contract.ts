import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/visual-harness/runtime";

export const pongVisualHarnessBridge = defineVisualHarnessBridge({
  gameId: "pong",
  selectSnapshot: (context: {
    host: {
      roomId: string | null;
      joinUrl: string | null;
      joinUrlStatus: string;
    };
    matchPhase: string | null;
    runtimeState: string | null;
    actions: {
      setPointsToWin: (payload: { pointsToWin: number }) => void;
      scorePoint: (payload: { team: "team1" | "team2" }) => void;
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
    setPointsToWin: bridgeAction.number(
      (
        context: {
          actions: {
            setPointsToWin: (payload: { pointsToWin: number }) => void;
          };
        },
        pointsToWin,
      ) => {
        context.actions.setPointsToWin({ pointsToWin });
      },
    ),
    scorePoint: bridgeAction.enum(
      ["team1", "team2"] as const,
      (
        context: {
          actions: {
            scorePoint: (payload: { team: "team1" | "team2" }) => void;
          };
        },
        team,
      ) => {
        context.actions.scorePoint({ team });
      },
    ),
  },
});
