import {
  getRoundOptionLabel,
  normalizeRoundOptionLabel,
  pickRoundOptionSongIds,
} from "@/game/content/round-options";
import {
  getSongsForBuckets,
  songBuckets,
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
  eligibleSongs,
}: {
  optionSongIds: readonly string[];
  correctSongId: string;
  guessKind: RoundGuessKind;
  eligibleSongs: readonly SongEntry[];
}): void => {
  const eligibleSongIds = new Set(eligibleSongs.map((song) => song.id));
  const optionLabels = optionSongIds.map((songId) =>
    normalizeRoundOptionLabel(
      getRoundOptionLabel(findSong(eligibleSongs, songId), guessKind),
    ),
  );

  expect(optionSongIds).toHaveLength(4);
  expect(new Set(optionSongIds).size).toBe(4);
  expect(
    optionSongIds.filter((songId) => songId === correctSongId),
  ).toHaveLength(1);
  expect(optionSongIds.every((songId) => eligibleSongIds.has(songId))).toBe(
    true,
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
  it("draws every answer from the exact selected category pool", () => {
    const eligibleSongs = getSongsForBuckets(["slovenian"]);
    const correctSongId = eligibleSongs[0]?.id;
    if (!correctSongId) {
      throw new Error("Expected the Slovenian bucket to contain songs.");
    }

    const optionSongIds = pickRoundOptionSongIds({
      correctSongId,
      optionCount: 4,
      guessKind: "song-title",
      eligibleSongs,
    });

    expectValidOptions({
      optionSongIds,
      correctSongId,
      guessKind: "song-title",
      eligibleSongs,
    });
  });

  it("includes a safe forced distractor for song-title rounds", () => {
    const eligibleSongs = getSongsForBuckets(["slovenian"]);
    const correctSongId = "all-my-friends-are-dead";
    const forcedOptionSongId = "prjatucki";

    const optionSongIds = pickRoundOptionSongIds({
      correctSongId,
      optionCount: 4,
      guessKind: "song-title",
      eligibleSongs,
    });

    expect(optionSongIds).toContain(correctSongId);
    expect(optionSongIds).toContain(forcedOptionSongId);
    expectValidOptions({
      optionSongIds,
      correctSongId,
      guessKind: "song-title",
      eligibleSongs,
    });
  });

  it("skips a forced distractor when it would repeat the visible artist", () => {
    const eligibleSongs = getSongsForBuckets(["slovenian"]);
    const correctSongId = "all-my-friends-are-dead";
    const unsafeForcedOptionSongId = "prjatucki";

    const optionSongIds = pickRoundOptionSongIds({
      correctSongId,
      optionCount: 4,
      guessKind: "artist",
      eligibleSongs,
    });

    expect(optionSongIds).toContain(correctSongId);
    expect(optionSongIds).not.toContain(unsafeForcedOptionSongId);
    expectValidOptions({
      optionSongIds,
      correctSongId,
      guessKind: "artist",
      eligibleSongs,
    });
  });

  it("fails when the correct song is outside the eligible pool", () => {
    const correctSong = makeSong({
      id: "correct",
      title: "Correct",
      artist: "Correct Artist",
    });
    const eligibleSongs = [
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
        eligibleSongs,
      }),
    ).toThrow(/not in the eligible song pool/i);
  });

  it("fails instead of repeating a visible label when the pool is insufficient", () => {
    const eligibleSongs = [
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
        eligibleSongs,
      }),
    ).toThrow(/not enough distinct artist labels/i);
  });

  it("preserves all invariants across every bucket and guess kind", () => {
    const guessKinds: readonly RoundGuessKind[] = ["song-title", "artist"];

    songBuckets.forEach((bucket) => {
      const eligibleSongs = getSongsForBuckets([bucket.id]);

      guessKinds.forEach((guessKind) => {
        const distinctLabels = new Set(
          eligibleSongs.map((song) =>
            normalizeRoundOptionLabel(getRoundOptionLabel(song, guessKind)),
          ),
        );
        expect(
          distinctLabels.size,
          `${bucket.id} needs four distinct ${guessKind} labels`,
        ).toBeGreaterThanOrEqual(4);

        for (let iteration = 0; iteration < 50; iteration += 1) {
          const correctSong = eligibleSongs[iteration % eligibleSongs.length];
          if (!correctSong) {
            throw new Error(`Expected songs in bucket "${bucket.id}".`);
          }

          const optionSongIds = pickRoundOptionSongIds({
            correctSongId: correctSong.id,
            optionCount: 4,
            guessKind,
            eligibleSongs,
          });

          expectValidOptions({
            optionSongIds,
            correctSongId: correctSong.id,
            guessKind,
            eligibleSongs,
          });
        }
      });
    });
  });
});
