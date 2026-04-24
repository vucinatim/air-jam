import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/harness/runtime";

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
      {
        description: "Set the score needed to win the match.",
        payloadDescription: "The numeric points-to-win target.",
        resultDescription:
          "The host lobby keeps the new points-to-win value for the next match.",
      },
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
      {
        description: "Award one point to the chosen team.",
        payloadDescription: "The team that should receive the point.",
        resultDescription:
          "The selected team score increments by one in the live match.",
      },
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
