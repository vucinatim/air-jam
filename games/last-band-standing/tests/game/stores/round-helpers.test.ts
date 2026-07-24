import {
  getSongById,
  getSongCanonicalKey,
  getSongsForBuckets,
  getSongsForQuizCategory,
} from "@/game/content/song-bank";
import {
  createRound,
  getPlaylistDifficultyTargets,
  pickPlaylistSongs,
} from "@/game/stores/round-helpers";
import { describe, expect, it } from "vitest";

describe("pickPlaylistSongs", () => {
  it("builds a ten-round default mix with an intentional difficulty curve", () => {
    const playlist = pickPlaylistSongs(10, [
      "global-pop",
      "slovenian",
      "balkan",
      "dance-edm",
      "meme",
    ]);
    const difficulties = playlist.songIds.map((songId) => {
      const song = getSongById(songId);
      if (!song) {
        throw new Error(`Expected playlist song ${songId} to exist.`);
      }

      return song.difficulty;
    });

    expect(difficulties.filter((difficulty) => difficulty <= 2)).toHaveLength(
      3,
    );
    expect(difficulties.filter((difficulty) => difficulty === 3)).toHaveLength(
      5,
    );
    expect(difficulties.filter((difficulty) => difficulty >= 4)).toHaveLength(
      2,
    );
    expect(new Set(playlist.songIds)).toHaveLength(10);
  });

  it("falls back to the available difficulties without blocking a match", () => {
    const playlist = pickPlaylistSongs(10, ["2010s"]);

    expect(playlist.songIds).toHaveLength(10);
    expect(new Set(playlist.songIds)).toHaveLength(10);
  });

  it("prefers unplayed songs before repeating songs from match history", () => {
    const songs = getSongsForBuckets(["2010s"]);
    const playedSongKeys = songs.slice(0, 5).map(getSongCanonicalKey);
    const playlist = pickPlaylistSongs(5, ["2010s"], playedSongKeys);

    expect(
      playlist.songIds.every(
        (songId) => !songs.slice(0, 5).some((song) => song.id === songId),
      ),
    ).toBe(true);
  });
});

describe("getPlaylistDifficultyTargets", () => {
  it("allocates the planned 30/50/20 ten-round mix", () => {
    expect(getPlaylistDifficultyTargets(10)).toEqual({
      easy: 3,
      medium: 5,
      hard: 2,
    });
  });

  it("always allocates exactly the requested number of rounds", () => {
    for (let count = 0; count <= 20; count += 1) {
      const targets = getPlaylistDifficultyTargets(count);

      expect(targets.easy + targets.medium + targets.hard).toBe(count);
    }
  });
});

describe("createRound", () => {
  it("keeps every answer inside the correct song's quiz category", () => {
    const eligibleSongs = getSongsForBuckets(["slovenian"]);
    const correctSong = eligibleSongs[0];
    if (!correctSong) {
      throw new Error("Expected the Slovenian bucket to contain songs.");
    }

    const round = createRound({
      roundNumber: 1,
      songId: correctSong.id,
      guessKind: "song-title",
      expectedPlayerIds: ["player-1"],
      nowMs: 1_000,
      roundDurationSec: 30,
    });
    const quizCategorySongIds = new Set(
      getSongsForQuizCategory(correctSong.quizCategoryId).map(
        (song) => song.id,
      ),
    );

    expect(round.songId).toBe(correctSong.id);
    expect(round.optionOrder).toHaveLength(4);
    expect(
      round.optionOrder.every((songId) => quizCategorySongIds.has(songId)),
    ).toBe(true);
  });
});
