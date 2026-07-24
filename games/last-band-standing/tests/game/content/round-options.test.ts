import {
  getRoundOptionLabel,
  normalizeRoundOptionLabel,
  pickRoundOptionSongIds,
} from "@/game/content/round-options";
import {
  getSongsForQuizCategory,
  songBank,
  type SongEntry,
} from "@/game/content/song-bank";
import { type RoundGuessKind } from "@/game/domain/types";
import { describe, expect, it } from "vitest";

const findSong = (songs: readonly SongEntry[], songId: string): SongEntry => {
  const song = songs.find((candidate) => candidate.id === songId);
  if (!song) {
    throw new Error(`Expected song "${songId}" in the test pool.`);
  }

  return song;
};

const expectValidOptions = ({
  optionSongIds,
  correctSongId,
  guessKind,
  catalogSongs,
}: {
  optionSongIds: readonly string[];
  correctSongId: string;
  guessKind: RoundGuessKind;
  catalogSongs: readonly SongEntry[];
}): void => {
  const correctSong = findSong(catalogSongs, correctSongId);
  const optionLabels = optionSongIds.map((songId) =>
    normalizeRoundOptionLabel(
      getRoundOptionLabel(findSong(catalogSongs, songId), guessKind),
    ),
  );
  const optionCategories = optionSongIds.map(
    (songId) => findSong(catalogSongs, songId).quizCategoryId,
  );

  expect(optionSongIds).toHaveLength(4);
  expect(new Set(optionSongIds).size).toBe(4);
  expect(
    optionSongIds.filter((songId) => songId === correctSongId),
  ).toHaveLength(1);
  expect(new Set(optionCategories)).toEqual(
    new Set([correctSong.quizCategoryId]),
  );
  expect(new Set(optionLabels).size).toBe(4);
};

const makeSong = ({
  id,
  title,
  artist,
  forcedOptionSongId,
}: {
  id: string;
  title: string;
  artist: string;
  forcedOptionSongId?: string;
}): SongEntry => ({
  id,
  title,
  artist,
  youtubeUrl: `https://www.youtube.com/watch?v=${id}`,
  clipStartSeconds: 30,
  bucketIds: ["global-pop"],
  quizCategoryId: "global-pop",
  difficulty: 3,
  ...(forcedOptionSongId ? { forcedOptionSongId } : {}),
});

describe("round option labels", () => {
  it("normalizes accented and non-Latin labels without deleting Unicode text", () => {
    expect(normalizeRoundOptionLabel("  ŽIVJO — БЕОГРАД 東京!  ")).toBe(
      "zivjo београд 東京",
    );
  });
});

describe("round option selection", () => {
  it("draws every answer from the correct song's canonical quiz category", () => {
    const categorySongs = getSongsForQuizCategory("slovenian");
    const correctSongId = categorySongs[0]?.id;
    if (!correctSongId) {
      throw new Error("Expected the Slovenian quiz category to contain songs.");
    }

    const optionSongIds = pickRoundOptionSongIds({
      correctSongId,
      optionCount: 4,
      guessKind: "song-title",
    });

    expectValidOptions({
      optionSongIds,
      correctSongId,
      guessKind: "song-title",
      catalogSongs: songBank,
    });
  });

  it("includes a safe forced distractor for song-title rounds", () => {
    const correctSongId = "all-my-friends-are-dead";
    const forcedOptionSongId = "prjatucki";

    const optionSongIds = pickRoundOptionSongIds({
      correctSongId,
      optionCount: 4,
      guessKind: "song-title",
    });

    expect(optionSongIds).toContain(correctSongId);
    expect(optionSongIds).toContain(forcedOptionSongId);
    expectValidOptions({
      optionSongIds,
      correctSongId,
      guessKind: "song-title",
      catalogSongs: songBank,
    });
  });

  it("skips a forced distractor when it would repeat the visible artist", () => {
    const correctSongId = "all-my-friends-are-dead";
    const unsafeForcedOptionSongId = "prjatucki";

    const optionSongIds = pickRoundOptionSongIds({
      correctSongId,
      optionCount: 4,
      guessKind: "artist",
    });

    expect(optionSongIds).toContain(correctSongId);
    expect(optionSongIds).not.toContain(unsafeForcedOptionSongId);
    expectValidOptions({
      optionSongIds,
      correctSongId,
      guessKind: "artist",
      catalogSongs: songBank,
    });
  });

  it("fails when the correct song is outside the supplied catalog", () => {
    const correctSong = makeSong({
      id: "correct",
      title: "Correct",
      artist: "Correct Artist",
    });
    const catalogSongs = [
      makeSong({ id: "a", title: "A", artist: "Artist A" }),
      makeSong({ id: "b", title: "B", artist: "Artist B" }),
      makeSong({ id: "c", title: "C", artist: "Artist C" }),
      makeSong({ id: "d", title: "D", artist: "Artist D" }),
    ];

    expect(() =>
      pickRoundOptionSongIds({
        correctSongId: correctSong.id,
        optionCount: 4,
        guessKind: "song-title",
        catalogSongs,
      }),
    ).toThrow(/not in the song catalog/i);
  });

  it("fails instead of repeating a visible label when the pool is insufficient", () => {
    const catalogSongs = [
      makeSong({ id: "a", title: "A", artist: "Shared Artist" }),
      makeSong({ id: "b", title: "B", artist: "Shared Artist" }),
      makeSong({ id: "c", title: "C", artist: "Artist C" }),
      makeSong({ id: "d", title: "D", artist: "Artist D" }),
    ];

    expect(() =>
      pickRoundOptionSongIds({
        correctSongId: "a",
        optionCount: 4,
        guessKind: "artist",
        catalogSongs,
      }),
    ).toThrow(/does not have enough distinct artist labels/i);
  });

  it("preserves every invariant for every song and guess kind", () => {
    const guessKinds: readonly RoundGuessKind[] = ["song-title", "artist"];

    songBank.forEach((correctSong) => {
      guessKinds.forEach((guessKind) => {
        const categorySongs = getSongsForQuizCategory(
          correctSong.quizCategoryId,
        );
        const distinctLabels = new Set(
          categorySongs.map((song) =>
            normalizeRoundOptionLabel(getRoundOptionLabel(song, guessKind)),
          ),
        );
        expect(
          distinctLabels.size,
          `${correctSong.quizCategoryId} needs four distinct ${guessKind} labels`,
        ).toBeGreaterThanOrEqual(4);

        for (let iteration = 0; iteration < 25; iteration += 1) {
          const optionSongIds = pickRoundOptionSongIds({
            correctSongId: correctSong.id,
            optionCount: 4,
            guessKind,
          });

          expectValidOptions({
            optionSongIds,
            correctSongId: correctSong.id,
            guessKind,
            catalogSongs: songBank,
          });
        }
      });
    });
  });
});
