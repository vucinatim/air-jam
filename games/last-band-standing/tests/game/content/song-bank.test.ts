import { DEFAULT_TOTAL_ROUNDS } from "@/game/constants";
import {
  defaultSelectedSongBucketIds,
  getSongCanonicalKey,
  getSongsForBuckets,
  getSongsForQuizCategory,
  getUniqueSongCountForBuckets,
  getUniqueSongsForBuckets,
  pickSongClipStartSeconds,
  songBank,
  songBuckets,
  toggleSelectedSongBucketIds,
} from "@/game/content/song-bank";
import {
  appendPlayedSongKeys,
  pickPlaylistSongs,
} from "@/game/stores/round-helpers";
import { describe, expect, it } from "vitest";

describe("song bank buckets", () => {
  it("keeps the expanded road-trip catalog at or above 180 songs", () => {
    expect(songBank.length).toBeGreaterThanOrEqual(180);
  });

  it("keeps every visible song bucket large enough for a default match", () => {
    songBuckets.forEach((bucket) => {
      expect(getSongsForBuckets([bucket.id]).length).toBeGreaterThanOrEqual(
        DEFAULT_TOTAL_ROUNDS,
      );
    });
  });

  it("keeps the default selected buckets equivalent to the full song bank", () => {
    expect(getSongsForBuckets(defaultSelectedSongBucketIds)).toHaveLength(
      songBank.length,
    );
  });

  it("stores each canonical artist and title pair exactly once", () => {
    const uniqueSongs = getUniqueSongsForBuckets(defaultSelectedSongBucketIds);
    const uniqueKeys = new Set(uniqueSongs.map(getSongCanonicalKey));

    expect(songBank).toHaveLength(uniqueKeys.size);
    expect(uniqueSongs).toHaveLength(uniqueKeys.size);
  });

  it("stores each song id exactly once", () => {
    expect(new Set(songBank.map((song) => song.id)).size).toBe(songBank.length);
    songBank.forEach((song) => {
      expect(song.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });
  });

  it("uses an explicit deterministic clip start for every song", () => {
    songBank.forEach((song) => {
      expect(Number.isInteger(song.clipStartSeconds)).toBe(true);
      expect(song.clipStartSeconds).toBeGreaterThanOrEqual(0);
      expect(pickSongClipStartSeconds(song)).toBe(song.clipStartSeconds);
    });
  });

  it("gives every song explicit, valid, non-repeating bucket ownership", () => {
    const validBucketIds = new Set(songBuckets.map((bucket) => bucket.id));

    songBank.forEach((song) => {
      expect(song.bucketIds.length).toBeGreaterThan(0);
      expect(new Set(song.bucketIds).size).toBe(song.bucketIds.length);
      song.bucketIds.forEach((bucketId) => {
        expect(validBucketIds.has(bucketId)).toBe(true);
      });
      expect(song.bucketIds).toContain(song.quizCategoryId);
    });
  });

  it("gives every song one curated difficulty from 1 through 5", () => {
    songBank.forEach((song) => {
      expect(Number.isInteger(song.difficulty)).toBe(true);
      expect(song.difficulty).toBeGreaterThanOrEqual(1);
      expect(song.difficulty).toBeLessThanOrEqual(5);
    });
  });

  it("keeps every quiz category viable for title and artist rounds", () => {
    songBuckets.forEach((bucket) => {
      const categorySongs = getSongsForQuizCategory(bucket.id);
      const titleLabels = new Set(
        categorySongs.map((song) => song.title.trim().toLocaleLowerCase()),
      );
      const artistLabels = new Set(
        categorySongs.map((song) => song.artist.trim().toLocaleLowerCase()),
      );

      expect(categorySongs.length, bucket.id).toBeGreaterThanOrEqual(4);
      expect(
        titleLabels.size,
        `${bucket.id} title labels`,
      ).toBeGreaterThanOrEqual(4);
      expect(
        artistLabels.size,
        `${bucket.id} artist labels`,
      ).toBeGreaterThanOrEqual(4);
    });
  });

  it("keeps regional browsing buckets inside their matching language pool", () => {
    (["slovenian", "balkan"] as const).forEach((bucketId) => {
      getSongsForBuckets([bucketId]).forEach((song) => {
        expect(song.quizCategoryId).toBe(bucketId);
      });
    });
  });

  it("keeps forced distractors inside the correct quiz category", () => {
    songBank.forEach((song) => {
      if (!song.forcedOptionSongId) return;

      const forcedOption = songBank.find(
        (candidate) => candidate.id === song.forcedOptionSongId,
      );
      expect(forcedOption?.quizCategoryId).toBe(song.quizCategoryId);
    });
  });

  it("treats an empty bucket selection as an empty song pool", () => {
    expect(getSongsForBuckets([])).toEqual([]);
    expect(getUniqueSongsForBuckets([])).toEqual([]);
  });

  it("toggles visible buckets and allows an empty selection", () => {
    expect(
      toggleSelectedSongBucketIds(defaultSelectedSongBucketIds, "meme"),
    ).not.toContain("meme");

    expect(toggleSelectedSongBucketIds(["meme"], "meme")).toEqual([]);
  });
});

describe("playlist selection", () => {
  it("does not repeat canonical songs in one playlist when enough songs exist", () => {
    const playlist = pickPlaylistSongs(
      DEFAULT_TOTAL_ROUNDS,
      defaultSelectedSongBucketIds,
    );

    expect(playlist.songIds).toHaveLength(DEFAULT_TOTAL_ROUNDS);
    expect(new Set(playlist.songKeys).size).toBe(DEFAULT_TOTAL_ROUNDS);
  });

  it("builds a full non-repeating playlist from every visible bucket", () => {
    songBuckets.forEach((bucket) => {
      const playlist = pickPlaylistSongs(DEFAULT_TOTAL_ROUNDS, [bucket.id]);

      expect(playlist.uniqueSongCount).toBe(
        getUniqueSongCountForBuckets([bucket.id]),
      );
      expect(playlist.songIds).toHaveLength(DEFAULT_TOTAL_ROUNDS);
      expect(new Set(playlist.songIds).size).toBe(DEFAULT_TOTAL_ROUNDS);
      expect(new Set(playlist.songKeys).size).toBe(DEFAULT_TOTAL_ROUNDS);
    });
  });

  it("prefers songs that have not appeared in the current session", () => {
    const firstPlaylist = pickPlaylistSongs(
      DEFAULT_TOTAL_ROUNDS,
      defaultSelectedSongBucketIds,
    );
    const playedSongKeys = appendPlayedSongKeys([], firstPlaylist.songKeys);
    const secondPlaylist = pickPlaylistSongs(
      DEFAULT_TOTAL_ROUNDS,
      defaultSelectedSongBucketIds,
      playedSongKeys,
    );

    expect(
      secondPlaylist.songKeys.some((songKey) =>
        playedSongKeys.includes(songKey),
      ),
    ).toBe(false);
  });
});
