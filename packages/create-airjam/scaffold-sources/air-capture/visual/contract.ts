import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "@air-jam/visual-harness/runtime";

const parseEndedMatchPayload = (
  payload: unknown,
  gameId: string,
): {
  winner: "solaris" | "nebulon";
  finalScores: {
    solaris: number;
    nebulon: number;
  };
} => {
  const candidate =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const finalScores =
    candidate?.finalScores &&
    typeof candidate.finalScores === "object" &&
    candidate.finalScores !== null
      ? (candidate.finalScores as Record<string, unknown>)
      : null;

  if (
    (candidate?.winner !== "solaris" && candidate?.winner !== "nebulon") ||
    typeof finalScores?.solaris !== "number" ||
    typeof finalScores?.nebulon !== "number"
  ) {
    throw new Error(
      `[visual-harness:${gameId}.endMatch] expected { winner, finalScores } with numeric Solaris and Nebulon scores`,
    );
  }

  return {
    winner: candidate.winner,
    finalScores: {
      solaris: finalScores.solaris,
      nebulon: finalScores.nebulon,
    },
  };
};

export const airCaptureVisualHarnessBridge = defineVisualHarnessBridge({
  gameId: "air-capture",
  selectSnapshot: (context: {
    host: {
      roomId: string | null;
      joinUrl: string | null;
      joinUrlStatus: string;
    };
    matchPhase: string | null;
    runtimeState: string | null;
    matchActions: {
      endMatch: (payload: {
        winner: "solaris" | "nebulon";
        finalScores: {
          solaris: number;
          nebulon: number;
        };
      }) => void;
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
    endMatch: bridgeAction.custom(
      (payload, meta) => parseEndedMatchPayload(payload, meta.gameId),
      (
        context: {
          matchActions: {
            endMatch: (payload: {
              winner: "solaris" | "nebulon";
              finalScores: {
                solaris: number;
                nebulon: number;
              };
            }) => void;
          };
        },
        payload,
      ) => {
        context.matchActions.endMatch(payload);
      },
    ),
  },
});
