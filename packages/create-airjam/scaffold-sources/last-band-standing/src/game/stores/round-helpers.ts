import { DEFAULT_OPTION_COUNT, STREAK_FIRE_MIN_ROUNDS } from "@/config";
import {
  buildRoundResults,
  findFirstCorrectSummary,
  shouldFinalizeRound,
  type RoundPlayerResult,
} from "@/game/domain/round-engine";
import {
  getRoundOptionLabel,
  getSongById,
  pickRoundOptionSongIds,
  songBank,
} from "@/song-bank";
import { type RoundGuessKind } from "@/types";
import { createEmptyScore } from "@/utils/player-utils";
import { shuffleList } from "@/utils/shuffle";
import { type ActiveRound, type PlayerScore, type QuizState } from "./types";

export const pickPlaylistSongIds = (count: number): string[] => {
  const shuffledSongs = shuffleList([...songBank]);
  return shuffledSongs.slice(0, count).map((song) => song.id);
};

export const pickPlaylistGuessKinds = (count: number): RoundGuessKind[] => {
  const halfCount = Math.floor(count / 2);
  const guessKinds: RoundGuessKind[] = [
    ...Array.from({ length: halfCount }, () => "song-title" as const),
    ...Array.from({ length: count - halfCount }, () => "artist" as const),
  ];

  return shuffleList(guessKinds);
};

export const createRound = (
  roundNumber: number,
  songId: string,
  guessKind: RoundGuessKind,
  expectedPlayerIds: string[],
  nowMs: number,
  roundDurationSec: number,
): ActiveRound => {
  const song = getSongById(songId);
  if (!song) {
    throw new Error(`Cannot create round for missing song: ${songId}`);
  }

  const optionOrder = pickRoundOptionSongIds(
    song.id,
    DEFAULT_OPTION_COUNT,
    guessKind,
  );

  return {
    roundNumber,
    songId,
    guessKind,
    optionOrder,
    startedAtMs: nowMs,
    endsAtMs: nowMs + roundDurationSec * 1000,
    expectedPlayerIds,
  };
};

export const createInitialScoreboard = (
  activePlayerIds: string[],
): Record<string, PlayerScore> => {
  return activePlayerIds.reduce<Record<string, PlayerScore>>(
    (scoreboard, playerId) => {
      scoreboard[playerId] = createEmptyScore();
      return scoreboard;
    },
    {},
  );
};

export const getTopRoundScorerIds = (
  expectedPlayerIds: string[],
  resultsByPlayerId: Record<string, RoundPlayerResult>,
): Set<string> => {
  const topRoundPoints = expectedPlayerIds.reduce((maxPoints, playerId) => {
    const roundPoints = resultsByPlayerId[playerId]?.points ?? 0;
    return Math.max(maxPoints, roundPoints);
  }, 0);

  if (topRoundPoints <= 0) {
    return new Set();
  }

  return new Set(
    expectedPlayerIds.filter((playerId) => {
      return (resultsByPlayerId[playerId]?.points ?? 0) === topRoundPoints;
    }),
  );
};

export const resetLobbyState = (state: QuizState): Partial<QuizState> => {
  const readyByPlayerId = state.playerOrder.reduce<Record<string, boolean>>(
    (nextReadyByPlayerId, playerId) => {
      nextReadyByPlayerId[playerId] = false;
      return nextReadyByPlayerId;
    },
    {},
  );

  return {
    phase: "lobby",
    readyByPlayerId,
    activePlayerIds: [],
    playlistSongIds: [],
    playlistGuessKinds: [],
    completedRoundCount: 0,
    currentRound: null,
    answersByPlayerId: {},
    roundReveal: null,
    scoreboardByPlayerId: {},
    finalRankingPlayerIds: [],
  };
};

export const finalizeRoundState = (
  state: QuizState,
  nowMs: number,
): QuizState => {
  if (state.phase !== "round-active" || !state.currentRound) {
    return state;
  }

  const song = getSongById(state.currentRound.songId);
  if (!song) {
    return state;
  }

  const shouldEndRound = shouldFinalizeRound({
    expectedPlayerIds: state.currentRound.expectedPlayerIds,
    answersByPlayerId: state.answersByPlayerId,
    correctOptionId: song.id,
    endPolicy: "wait-for-all",
    nowMs,
    roundWindow: {
      startedAtMs: state.currentRound.startedAtMs,
      endsAtMs: state.currentRound.endsAtMs,
    },
  });

  if (!shouldEndRound) {
    return state;
  }

  const resultsByPlayerId = buildRoundResults(
    state.currentRound.expectedPlayerIds,
    state.answersByPlayerId,
    song.id,
    {
      startedAtMs: state.currentRound.startedAtMs,
      endsAtMs: state.currentRound.endsAtMs,
    },
  );
  const firstCorrectSummary = findFirstCorrectSummary(
    state.currentRound.expectedPlayerIds,
    resultsByPlayerId,
  );
  const topRoundScorerIds = getTopRoundScorerIds(
    state.currentRound.expectedPlayerIds,
    resultsByPlayerId,
  );

  const nextScoreboard = { ...state.scoreboardByPlayerId };

  state.currentRound.expectedPlayerIds.forEach((playerId) => {
    const previousScore = nextScoreboard[playerId] ?? createEmptyScore();
    const playerRoundResult = resultsByPlayerId[playerId];
    const didAnswer = playerRoundResult.responseMs !== null;
    const scoredMostPointsThisRound = topRoundScorerIds.has(playerId);
    const mostPointsStreak = scoredMostPointsThisRound
      ? previousScore.mostPointsStreak + 1
      : 0;

    nextScoreboard[playerId] = {
      points: previousScore.points + playerRoundResult.points,
      correct: previousScore.correct + (playerRoundResult.isCorrect ? 1 : 0),
      wrong: previousScore.wrong + (playerRoundResult.isCorrect ? 0 : 1),
      totalResponseMs:
        previousScore.totalResponseMs + (playerRoundResult.responseMs ?? 0),
      answeredRounds: previousScore.answeredRounds + (didAnswer ? 1 : 0),
      mostPointsStreak,
      hasStreakFire: mostPointsStreak >= STREAK_FIRE_MIN_ROUNDS,
    };
  });

  return {
    ...state,
    phase: "round-reveal",
    completedRoundCount: state.currentRound.roundNumber,
    currentRound: null,
    answersByPlayerId: {},
    roundReveal: {
      roundNumber: state.currentRound.roundNumber,
      songId: state.currentRound.songId,
      songTitle: song.title,
      songArtist: song.artist,
      guessKind: state.currentRound.guessKind,
      correctOptionId: song.id,
      correctOptionLabel: getRoundOptionLabel(
        song,
        state.currentRound.guessKind,
      ),
      firstCorrectPlayerId: firstCorrectSummary.playerId,
      firstCorrectResponseMs: firstCorrectSummary.responseMs,
      resultsByPlayerId,
      revealEndsAtMs: nowMs + state.revealDurationSec * 1000,
    },
    scoreboardByPlayerId: nextScoreboard,
  };
};
