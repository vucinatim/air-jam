import { DEFAULT_OPTION_COUNT, STREAK_FIRE_MIN_ROUNDS } from "@/game/constants";
import {
  getRoundOptionLabel,
  pickRoundOptionSongIds,
} from "@/game/content/round-options";
import {
  getSongById,
  getSongCanonicalKey,
  getUniqueSongsForBuckets,
  pickSongClipStartSeconds,
  type SongBucketId,
  type SongEntry,
} from "@/game/content/song-bank";
import { createEmptyScore } from "@/game/domain/player-utils";
import {
  buildRoundResults,
  findFirstCorrectSummary,
  shouldFinalizeRound,
  type RoundPlayerResult,
} from "@/game/domain/round-engine";
import { shuffleList } from "@/game/domain/shuffle";
import { type RoundGuessKind } from "@/game/domain/types";
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
  roundNumber: number;
  songId: string;
  guessKind: RoundGuessKind;
  expectedPlayerIds: string[];
  nowMs: number;
  roundDurationSec: number;
}

export const createRound = ({
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
    optionCount: DEFAULT_OPTION_COUNT,
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
      revealEndsAtMs: nowMs + state.revealDurationSec * 1000,
    },
    scoreboardByPlayerId: nextScoreboard,
  };
};
