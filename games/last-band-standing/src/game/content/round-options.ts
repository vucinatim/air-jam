import { shuffleList } from "@/game/domain/shuffle";
import { type RoundGuessKind } from "@/game/domain/types";
import { normalizeSongValue, type SongEntry } from "./song-bank";

export interface PickRoundOptionSongIdsOptions {
  correctSongId: string;
  optionCount: number;
  guessKind: RoundGuessKind;
  eligibleSongs: readonly SongEntry[];
}

export const normalizeRoundOptionLabel = (value: string): string => {
  return normalizeSongValue(value);
};

export const getRoundOptionLabel = (
  song: SongEntry,
  guessKind: RoundGuessKind,
): string => {
  return guessKind === "artist" ? song.artist : song.title;
};

export const hasEnoughRoundOptionLabels = (
  eligibleSongs: readonly SongEntry[],
  optionCount: number,
  guessKind: RoundGuessKind,
): boolean => {
  const distinctLabels = new Set(
    eligibleSongs.map((song) =>
      normalizeRoundOptionLabel(getRoundOptionLabel(song, guessKind)),
    ),
  );

  distinctLabels.delete("");
  return distinctLabels.size >= optionCount;
};

/**
 * Selects one correct answer and label-distinct distractors from the exact
 * catalog slice that is eligible for the match.
 */
export const pickRoundOptionSongIds = ({
  correctSongId,
  optionCount,
  guessKind,
  eligibleSongs,
}: PickRoundOptionSongIdsOptions): string[] => {
  if (optionCount < 2) {
    throw new Error("optionCount must be at least 2.");
  }

  const songsById = new Map(eligibleSongs.map((song) => [song.id, song]));
  if (songsById.size !== eligibleSongs.length) {
    throw new Error("Eligible songs must have unique ids.");
  }

  const correctSong = songsById.get(correctSongId);
  if (!correctSong) {
    throw new Error(
      `Correct song "${correctSongId}" is not in the eligible song pool.`,
    );
  }

  const selectedSongIds = [correctSong.id];
  const selectedSongIdSet = new Set(selectedSongIds);
  const correctLabel = normalizeRoundOptionLabel(
    getRoundOptionLabel(correctSong, guessKind),
  );

  if (!correctLabel) {
    throw new Error(
      `Song "${correctSong.id}" has an empty ${guessKind} label.`,
    );
  }

  const usedLabels = new Set([correctLabel]);
  const forcedOptionSong = correctSong.forcedOptionSongId
    ? songsById.get(correctSong.forcedOptionSongId)
    : undefined;
  const remainingSongs = shuffleList(
    eligibleSongs.filter(
      (song) => song.id !== correctSong.id && song.id !== forcedOptionSong?.id,
    ),
  );
  const candidates = forcedOptionSong
    ? [forcedOptionSong, ...remainingSongs]
    : remainingSongs;

  for (const candidate of candidates) {
    if (selectedSongIds.length >= optionCount) {
      break;
    }

    if (selectedSongIdSet.has(candidate.id)) {
      continue;
    }

    const candidateLabel = normalizeRoundOptionLabel(
      getRoundOptionLabel(candidate, guessKind),
    );
    if (!candidateLabel || usedLabels.has(candidateLabel)) {
      continue;
    }

    selectedSongIds.push(candidate.id);
    selectedSongIdSet.add(candidate.id);
    usedLabels.add(candidateLabel);
  }

  if (selectedSongIds.length < optionCount) {
    throw new Error(
      `Not enough distinct ${guessKind} labels to build ${optionCount} options from the eligible song pool.`,
    );
  }

  return shuffleList(selectedSongIds);
};
