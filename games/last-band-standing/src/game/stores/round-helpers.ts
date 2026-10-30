import {
  getRoundOptionLabel,
  pickRoundOptionSongIds,
} from "../content/round-options";
import {
  getSongById,
  getSongCanonicalKey,
  getUniqueSongsForBuckets,
  pickSongClipStartSeconds,
  type SongBucketId,
  type SongEntry,
} from "../content/song-bank";
import type { QuizSettings } from "../contracts/settings";
import { createEmptyScore } from "../domain/player-utils";
import {
  buildRoundResults,
  findFirstCorrectSummary,
  rankPlayers,
  shouldFinalizeRound,
  type RoundPlayerResult,
} from "../domain/round-engine";
import { shuffleList } from "../domain/shuffle";
import { type RoundGuessKind } from "../domain/types";
import { type ActiveRound, type PlayerScore, type QuizState } from "./types";

export interface PlaylistSelection {
  songIds: string[];
  songKeys: string[];
  uniqueSongCount: number;
}

export type PlaylistDifficultyBand = "easy" | "medium" | "hard";

export interface PlaylistDifficultyTargets {
  easy: number;
  medium: number;
  hard: number;
}

const playlistDifficultyBands = ["easy", "medium", "hard"] as const;

const getSongDifficultyBand = (song: SongEntry): PlaylistDifficultyBand => {
  if (song.difficulty <= 2) {
    return "easy";
  }

  if (song.difficulty === 3) {
    return "medium";
  }

  return "hard";
};

export const getPlaylistDifficultyTargets = (
  count: number,
): PlaylistDifficultyTargets => {
  const normalizedCount = Math.max(0, Math.floor(count));
  const easy = Math.round(normalizedCount * 0.3);
  const hard = Math.round(normalizedCount * 0.2);

  return {
    easy,
    medium: normalizedCount - easy - hard,
    hard,
  };
};

const groupSongsByDifficulty = (
  songs: readonly SongEntry[],
): Record<PlaylistDifficultyBand, SongEntry[]> => {
  const groupedSongs: Record<PlaylistDifficultyBand, SongEntry[]> = {
    easy: [],
    medium: [],
    hard: [],
  };

  songs.forEach((song) => {
    groupedSongs[getSongDifficultyBand(song)].push(song);
  });

  return {
    easy: shuffleList(groupedSongs.easy),
    medium: shuffleList(groupedSongs.medium),
    hard: shuffleList(groupedSongs.hard),
  };
};

const buildDifficultyRequests = (
  targets: PlaylistDifficultyTargets,
): PlaylistDifficultyBand[] =>
  shuffleList(
    playlistDifficultyBands.flatMap((band) =>
      Array.from({ length: targets[band] }, () => band),
    ),
  );

const subtractSelectedDifficulties = (
  targets: PlaylistDifficultyTargets,
  selectedSongs: readonly SongEntry[],
): PlaylistDifficultyTargets => {
  const remainingTargets = { ...targets };

  selectedSongs.forEach((song) => {
    const band = getSongDifficultyBand(song);
    remainingTargets[band] = Math.max(0, remainingTargets[band] - 1);
  });

  return remainingTargets;
};

const pickBalancedSongBatch = (
  count: number,
  songs: readonly SongEntry[],
  targets: PlaylistDifficultyTargets,
): SongEntry[] => {
  const songsByDifficulty = groupSongsByDifficulty(songs);
  const selectedSongs: SongEntry[] = [];

  buildDifficultyRequests(targets).forEach((band) => {
    if (selectedSongs.length >= count) {
      return;
    }

    const song = songsByDifficulty[band].pop();
    if (song) {
      selectedSongs.push(song);
    }
  });

  const fallbackSongs = shuffleList(
    playlistDifficultyBands.flatMap((band) => songsByDifficulty[band]),
  );

  return [
    ...selectedSongs,
    ...fallbackSongs.slice(0, count - selectedSongs.length),
  ];
};

const pickBalancedSongs = (
  count: number,
  unplayedSongs: readonly SongEntry[],
  playedSongs: readonly SongEntry[],
): SongEntry[] => {
  const targets = getPlaylistDifficultyTargets(count);
  const selectedUnplayedSongs = pickBalancedSongBatch(
    Math.min(count, unplayedSongs.length),
    unplayedSongs,
    targets,
  );
  const remainingCount = count - selectedUnplayedSongs.length;
  const selectedPlayedSongs = pickBalancedSongBatch(
    remainingCount,
    playedSongs,
    subtractSelectedDifficulties(targets, selectedUnplayedSongs),
  );

  return shuffleList([...selectedUnplayedSongs, ...selectedPlayedSongs]);
};

export const pickPlaylistSongs = (
  count: number,
  selectedSongBucketIds: readonly SongBucketId[],
  playedSongKeys: readonly string[] = [],
): PlaylistSelection => {
  const uniqueSongs = getUniqueSongsForBuckets(selectedSongBucketIds);
  if (uniqueSongs.length < count) {
    return {
      songIds: [],
      songKeys: [],
      uniqueSongCount: uniqueSongs.length,
    };
  }

  const playedSongKeySet = new Set(playedSongKeys);
  const unplayedSongs = uniqueSongs.filter(
    (song) => !playedSongKeySet.has(getSongCanonicalKey(song)),
  );
  const playedSongs = uniqueSongs.filter((song) =>
    playedSongKeySet.has(getSongCanonicalKey(song)),
  );
  const selectedSongs = pickBalancedSongs(count, unplayedSongs, playedSongs);

  return {
    songIds: selectedSongs.map((song) => song.id),
    songKeys: selectedSongs.map(getSongCanonicalKey),
    uniqueSongCount: uniqueSongs.length,
  };
};

export const appendPlayedSongKeys = (
  existingSongKeys: readonly string[],
  playedSongKeys: readonly string[],
): string[] => {
  const nextPlayedSongKeySet = new Set(playedSongKeys);
  return [
    ...existingSongKeys.filter((songKey) => !nextPlayedSongKeySet.has(songKey)),
    ...playedSongKeys,
  ];
};

export const pickPlaylistGuessKinds = (count: number): RoundGuessKind[] => {
  const halfCount = Math.floor(count / 2);
  const guessKinds: RoundGuessKind[] = [
    ...Array.from({ length: halfCount }, () => "song-title" as const),
    ...Array.from({ length: count - halfCount }, () => "artist" as const),
  ];

  return shuffleList(guessKinds);
};

export interface CreateRoundOptions {
  settings: QuizSettings;
  roundNumber: number;
  songId: string;
  guessKind: RoundGuessKind;
  expectedPlayerIds: string[];
  nowMs: number;
  roundDurationSec: number;
}

export const createRound = ({
  settings,
  roundNumber,
  songId,
  guessKind,
  expectedPlayerIds,
  nowMs,
  roundDurationSec,
}: CreateRoundOptions): ActiveRound => {
  const song = getSongById(songId);
  if (!song) {
    throw new Error(`Cannot create round for missing song: ${songId}`);
  }

  const optionOrder = pickRoundOptionSongIds({
    correctSongId: song.id,
    optionCount: settings.optionCount,
    guessKind,
  });

  return {
    roundNumber,
    songId,
    clipStartSeconds: pickSongClipStartSeconds(song),
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
  settings: QuizSettings,
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
      hasStreakFire: mostPointsStreak >= settings.streakFireMinRounds,
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
      clipStartSeconds: state.currentRound.clipStartSeconds,
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
      revealEndsAtMs: nowMs + settings.revealDurationSec * 1000,
    },
    scoreboardByPlayerId: nextScoreboard,
  };
};

const completeMatchCountdownState = (
  state: QuizState,
  nowMs: number,
): QuizState => {
  if (
    state.phase !== "match-countdown" ||
    !state.currentRound ||
    nowMs < state.currentRound.startedAtMs
  ) {
    return state;
  }

  const startDelayMs = nowMs - state.currentRound.startedAtMs;
  return {
    ...state,
    phase: "round-active",
    currentRound:
      startDelayMs > 0
        ? {
            ...state.currentRound,
            startedAtMs: nowMs,
            endsAtMs: state.currentRound.endsAtMs + startDelayMs,
          }
        : state.currentRound,
  };
};

const advanceFromRevealState = (
  state: QuizState,
  nowMs: number,
  settings: QuizSettings,
): QuizState => {
  if (
    state.phase !== "round-reveal" ||
    !state.roundReveal ||
    nowMs < state.roundReveal.revealEndsAtMs
  ) {
    return state;
  }

  const nextRoundNumber = state.completedRoundCount + 1;
  const nextSongId = state.playlistSongIds[nextRoundNumber - 1];
  const nextGuessKind = state.playlistGuessKinds[nextRoundNumber - 1];

  if (nextRoundNumber > settings.totalRounds || !nextSongId || !nextGuessKind) {
    return {
      ...state,
      phase: "game-over",
      currentRound: null,
      roundReveal: null,
      finalRankingPlayerIds: rankPlayers(state.scoreboardByPlayerId),
    };
  }

  return {
    ...state,
    phase: "round-active",
    currentRound: createRound({
      settings,
      roundNumber: nextRoundNumber,
      songId: nextSongId,
      guessKind: nextGuessKind,
      expectedPlayerIds: state.activePlayerIds,
      nowMs,
      roundDurationSec: settings.roundDurationSec,
    }),
    answersByPlayerId: {},
    roundReveal: null,
  };
};

const phaseDeadlineMs = (state: QuizState): number | null => {
  if (state.phase === "match-countdown")
    return state.currentRound?.startedAtMs ?? null;
  if (state.phase === "round-active")
    return state.currentRound?.endsAtMs ?? null;
  if (state.phase === "round-reveal")
    return state.roundReveal?.revealEndsAtMs ?? null;
  return null;
};

/**
 * Applies what game time makes due: the countdown ending, a round finishing
 * or a reveal moving on, and the whole seconds left that screens show.
 */
export const advanceRoundClock = (
  state: QuizState,
  nowMs: number,
  settings: QuizSettings,
): QuizState => {
  const countdownShiftMs =
    state.phase === "match-countdown"
      ? (settings.matchStartCountdownSec - state.matchStartCountdownSec) * 1000
      : 0;
  const changed =
    state.matchStartCountdownSec !== settings.matchStartCountdownSec ||
    state.totalRounds !== settings.totalRounds ||
    state.roundDurationSec !== settings.roundDurationSec ||
    state.revealDurationSec !== settings.revealDurationSec;
  if (changed) {
    const missing = Math.max(
      0,
      settings.totalRounds - state.playlistSongIds.length,
    );
    const extra =
      missing > 0
        ? pickPlaylistSongs(
            missing,
            state.selectedSongBucketIds,
            state.playedSongKeys,
          )
        : null;
    state = {
      ...state,
      matchStartCountdownSec: settings.matchStartCountdownSec,
      totalRounds: settings.totalRounds,
      roundDurationSec: settings.roundDurationSec,
      revealDurationSec: settings.revealDurationSec,
      currentRound: state.currentRound
        ? {
            ...state.currentRound,
            startedAtMs: state.currentRound.startedAtMs + countdownShiftMs,
            endsAtMs:
              state.currentRound.startedAtMs +
              countdownShiftMs +
              settings.roundDurationSec * 1000,
          }
        : null,
      roundReveal: state.roundReveal
        ? {
            ...state.roundReveal,
            revealEndsAtMs:
              state.roundReveal.revealEndsAtMs +
              (settings.revealDurationSec - state.revealDurationSec) * 1000,
          }
        : null,
      ...(extra
        ? {
            playlistSongIds: [...state.playlistSongIds, ...extra.songIds],
            playlistGuessKinds: [
              ...state.playlistGuessKinds,
              ...pickPlaylistGuessKinds(extra.songIds.length),
            ],
            playedSongKeys: appendPlayedSongKeys(
              state.playedSongKeys,
              extra.songKeys,
            ),
          }
        : {}),
    };
  }
  const next = advanceFromRevealState(
    finalizeRoundState(
      completeMatchCountdownState(state, nowMs),
      nowMs,
      settings,
    ),
    nowMs,
    settings,
  );
  const deadlineMs = phaseDeadlineMs(next);
  const secondsLeft =
    deadlineMs === null
      ? 0
      : Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
  return secondsLeft === next.secondsLeft ? next : { ...next, secondsLeft };
};
