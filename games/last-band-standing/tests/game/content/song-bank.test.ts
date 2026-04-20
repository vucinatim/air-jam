import { DEFAULT_TOTAL_ROUNDS } from "@/game/constants";
import {
  defaultSelectedSongBucketIds,
  getSongCanonicalKey,
  getSongsForBuckets,
  getUniqueSongCountForBuckets,
  getUniqueSongsForBuckets,
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
  it("keeps every visible song bucket playable", () => {
    songBuckets.forEach((bucket) => {
      expect(getSongsForBuckets([bucket.id]).length).toBeGreaterThan(0);
    });
  });

  it("keeps the default selected buckets equivalent to the full song bank", () => {
    expect(getSongsForBuckets(defaultSelectedSongBucketIds)).toHaveLength(
      songBank.length,
    );
  });

  it("deduplicates songs by canonical artist and title", () => {
    const uniqueSongs = getUniqueSongsForBuckets(defaultSelectedSongBucketIds);
    const uniqueKeys = new Set(uniqueSongs.map(getSongCanonicalKey));

    expect(uniqueSongs).toHaveLength(uniqueKeys.size);
    expect(uniqueSongs.length).toBeLessThan(songBank.length);
  });

  it("toggles visible buckets without allowing an empty selection", () => {
    expect(
      toggleSelectedSongBucketIds(defaultSelectedSongBucketIds, "meme"),
    ).not.toContain("meme");

    expect(toggleSelectedSongBucketIds(["meme"], "meme")).toEqual(["meme"]);
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

  it("does not silently cycle small buckets", () => {
    const playlist = pickPlaylistSongs(DEFAULT_TOTAL_ROUNDS, ["slovenian"]);

    expect(playlist.uniqueSongCount).toBe(
      getUniqueSongCountForBuckets(["slovenian"]),
    );
    expect(playlist.uniqueSongCount).toBeLessThan(DEFAULT_TOTAL_ROUNDS);
    expect(playlist.songIds).toEqual([]);
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
