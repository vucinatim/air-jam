import { shuffleList } from "@/game/domain/shuffle";
import { type RoundGuessKind } from "@/game/domain/types";
import { normalizeSongValue, songBank, type SongEntry } from "./song-bank";

export interface PickRoundOptionSongIdsOptions {
  correctSongId: string;
  optionCount: number;
  guessKind: RoundGuessKind;
  catalogSongs?: readonly SongEntry[];
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
  categorySongs: readonly SongEntry[],
  optionCount: number,
  guessKind: RoundGuessKind,
): boolean => {
  const distinctLabels = new Set(
    categorySongs.map((song) =>
      normalizeRoundOptionLabel(getRoundOptionLabel(song, guessKind)),
    ),
  );

  distinctLabels.delete("");
  return distinctLabels.size >= optionCount;
};

/**
 * Selects one correct answer and label-distinct distractors from the correct
 * song's canonical quiz category. Browsing buckets never affect answer pools.
 */
export const pickRoundOptionSongIds = ({
  correctSongId,
  optionCount,
  guessKind,
  catalogSongs = songBank,
}: PickRoundOptionSongIdsOptions): string[] => {
  if (optionCount < 2) {
    throw new Error("optionCount must be at least 2.");
  }

  const songsById = new Map(catalogSongs.map((song) => [song.id, song]));
  if (songsById.size !== catalogSongs.length) {
    throw new Error("Catalog songs must have unique ids.");
  }

  const correctSong = songsById.get(correctSongId);
  if (!correctSong) {
    throw new Error(
      `Correct song "${correctSongId}" is not in the song catalog.`,
    );
  }

  const categorySongs = catalogSongs.filter(
    (song) => song.quizCategoryId === correctSong.quizCategoryId,
  );
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
  if (
    forcedOptionSong &&
    forcedOptionSong.quizCategoryId !== correctSong.quizCategoryId
  ) {
    throw new Error(
      `Forced option "${forcedOptionSong.id}" is outside quiz category "${correctSong.quizCategoryId}".`,
    );
  }

  const remainingSongs = shuffleList(
    categorySongs.filter(
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
      `Quiz category "${correctSong.quizCategoryId}" does not have enough distinct ${guessKind} labels to build ${optionCount} options.`,
    );
  }

  return shuffleList(selectedSongIds);
};
