import {
  getSongsForBuckets,
  getSongsForQuizCategory,
} from "@/game/content/song-bank";
import { createRound } from "@/game/stores/round-helpers";
import { describe, expect, it } from "vitest";

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
