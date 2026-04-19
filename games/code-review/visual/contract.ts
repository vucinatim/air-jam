import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/visual-harness/runtime";

const parseForceEndPayload = (
  payload: unknown,
  gameId: string,
): {
  scores: {
    team1: number;
    team2: number;
  };
} => {
  const candidate =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const scores =
    candidate?.scores && typeof candidate.scores === "object"
      ? (candidate.scores as Record<string, unknown>)
      : null;

  if (typeof scores?.team1 !== "number" || typeof scores?.team2 !== "number") {
    throw new Error(
      `[visual-harness:${gameId}.forceEndMatch] expected { scores: { team1: number, team2: number } }`,
    );
  }

  return {
    scores: {
      team1: scores.team1,
      team2: scores.team2,
    },
  };
};

export const codeReviewVisualHarnessBridge = defineVisualHarnessBridge({
  gameId: "code-review",
  selectSnapshot: (context: {
    host: {
      roomId: string | null;
      joinUrl: string | null;
      joinUrlStatus: string;
    };
    matchPhase: string | null;
    runtimeState: string | null;
    scores: {
      team1: number;
      team2: number;
    };
    actions: {
      scorePoint: (payload: { team: "team1" | "team2" }) => void;
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
      (payload, meta) => parseForceEndPayload(payload, meta.gameId),
      (
        context: {
          scores: {
            team1: number;
            team2: number;
          };
          actions: {
            scorePoint: (payload: { team: "team1" | "team2" }) => void;
            finishMatch: () => void;
          };
        },
        payload,
      ) => {
        const team1Diff = Math.max(
          0,
          payload.scores.team1 - context.scores.team1,
        );
        for (let index = 0; index < team1Diff; index += 1) {
          context.actions.scorePoint({ team: "team1" });
        }

        const team2Diff = Math.max(
          0,
          payload.scores.team2 - context.scores.team2,
        );
        for (let index = 0; index < team2Diff; index += 1) {
          context.actions.scorePoint({ team: "team2" });
        }

        context.actions.finishMatch();
      },
    ),
  },
});
