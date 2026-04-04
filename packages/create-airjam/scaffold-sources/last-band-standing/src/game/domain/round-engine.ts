import { type RoundEndPolicy } from "@/types";
import { clampNumber } from "@/utils/math-utils";

export interface PlayerAnswer {
  optionId: string;
  answeredAtMs: number;
}

export interface RoundWindow {
  startedAtMs: number;
  endsAtMs: number;
}

export interface RoundCompletionInput {
  expectedPlayerIds: string[];
  answersByPlayerId: Record<string, PlayerAnswer>;
  correctOptionId: string;
  endPolicy: RoundEndPolicy;
  nowMs: number;
  roundWindow: RoundWindow;
}

export interface RoundPlayerResult {
  optionId: string | null;
  answeredAtMs: number | null;
  responseMs: number | null;
  isCorrect: boolean;
  points: number;
}

export interface FirstCorrectSummary {
  playerId: string | null;
  responseMs: number | null;
}

export const calculateCorrectGuessPoints = (
  answeredAtMs: number,
  roundWindow: RoundWindow,
): number => {
  const roundDurationMs = Math.max(1, roundWindow.endsAtMs - roundWindow.startedAtMs);
  const remainingMs = clampNumber(roundWindow.endsAtMs - answeredAtMs, 0, roundDurationMs);
  const timeLeftRatio = remainingMs / roundDurationMs;

  return 100 + Math.floor(400 * timeLeftRatio);
};

const hasEveryoneAnswered = (
  expectedPlayerIds: string[],
  answersByPlayerId: Record<string, PlayerAnswer>,
): boolean => {
  return expectedPlayerIds.every((playerId) => Boolean(answersByPlayerId[playerId]));
};

const hasRapidCorrectAnswer = (
  expectedPlayerIds: string[],
  answersByPlayerId: Record<string, PlayerAnswer>,
  correctOptionId: string,
): boolean => {
  return expectedPlayerIds.some(
    (playerId) => answersByPlayerId[playerId]?.optionId === correctOptionId,
  );
};

export const shouldFinalizeRound = (input: RoundCompletionInput): boolean => {
  const didTimeExpire = input.nowMs >= input.roundWindow.endsAtMs;

  if (didTimeExpire) {
    return true;
  }

  if (hasEveryoneAnswered(input.expectedPlayerIds, input.answersByPlayerId)) {
    return true;
  }

  if (input.endPolicy === "rapid") {
    return hasRapidCorrectAnswer(
      input.expectedPlayerIds,
      input.answersByPlayerId,
      input.correctOptionId,
    );
  }

  return false;
};

export const buildRoundResults = (
  expectedPlayerIds: string[],
  answersByPlayerId: Record<string, PlayerAnswer>,
  correctOptionId: string,
  roundWindow: RoundWindow,
): Record<string, RoundPlayerResult> => {
  return expectedPlayerIds.reduce<Record<string, RoundPlayerResult>>((results, playerId) => {
    const answer = answersByPlayerId[playerId] ?? null;
    const isCorrect = answer?.optionId === correctOptionId;
    const responseMs = answer
      ? clampNumber(answer.answeredAtMs - roundWindow.startedAtMs, 0, roundWindow.endsAtMs - roundWindow.startedAtMs)
      : null;

    results[playerId] = {
      optionId: answer?.optionId ?? null,
      answeredAtMs: answer?.answeredAtMs ?? null,
      responseMs,
      isCorrect,
      points: isCorrect ? calculateCorrectGuessPoints(answer.answeredAtMs, roundWindow) : 0,
    };

    return results;
  }, {});
};

export const findFirstCorrectSummary = (
  expectedPlayerIds: string[],
  resultsByPlayerId: Record<string, RoundPlayerResult>,
): FirstCorrectSummary => {
  const firstCorrectResult = expectedPlayerIds.reduce<{
    playerId: string;
    answeredAtMs: number;
    responseMs: number;
  } | null>((bestResult, playerId) => {
    const result = resultsByPlayerId[playerId];
    if (!result || !result.isCorrect || result.answeredAtMs === null || result.responseMs === null) {
      return bestResult;
    }

    if (!bestResult) {
      return {
        playerId,
        answeredAtMs: result.answeredAtMs,
        responseMs: result.responseMs,
      };
    }

    if (result.answeredAtMs < bestResult.answeredAtMs) {
      return {
        playerId,
        answeredAtMs: result.answeredAtMs,
        responseMs: result.responseMs,
      };
    }

    if (result.answeredAtMs > bestResult.answeredAtMs) {
      return bestResult;
    }

    if (result.responseMs < bestResult.responseMs) {
      return {
        playerId,
        answeredAtMs: result.answeredAtMs,
        responseMs: result.responseMs,
      };
    }

    if (result.responseMs > bestResult.responseMs) {
      return bestResult;
    }

    if (playerId < bestResult.playerId) {
      return {
        playerId,
        answeredAtMs: result.answeredAtMs,
        responseMs: result.responseMs,
      };
    }

    return bestResult;
  }, null);

  if (!firstCorrectResult) {
    return {
      playerId: null,
      responseMs: null,
    };
  }

  return {
    playerId: firstCorrectResult.playerId,
    responseMs: firstCorrectResult.responseMs,
  };
};

export const rankPlayers = (
  scoreboardByPlayerId: Record<
    string,
    {
      points: number;
      totalResponseMs: number;
      answeredRounds: number;
    }
  >,
): string[] => {
  return Object.entries(scoreboardByPlayerId)
    .sort(([playerIdA, scoreA], [playerIdB, scoreB]) => {
      if (scoreA.points !== scoreB.points) {
        return scoreB.points - scoreA.points;
      }

      const averageA =
        scoreA.answeredRounds > 0
          ? scoreA.totalResponseMs / scoreA.answeredRounds
          : Number.POSITIVE_INFINITY;
      const averageB =
        scoreB.answeredRounds > 0
          ? scoreB.totalResponseMs / scoreB.answeredRounds
          : Number.POSITIVE_INFINITY;

      if (averageA !== averageB) {
        return averageA - averageB;
      }

      return playerIdA.localeCompare(playerIdB);
    })
    .map(([playerId]) => playerId);
};
