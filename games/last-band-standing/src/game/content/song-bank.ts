import { z } from "zod";
import { songCatalog } from "./catalog";
import { songBuckets, type SongBucketId } from "./song-buckets";

export {
  songBuckets,
  type SongBucketId,
  type SongDifficulty,
} from "./song-buckets";

const songBucketIdSchema = z.enum(songBuckets.map((bucket) => bucket.id));

export const defaultSelectedSongBucketIds: SongBucketId[] = songBuckets.map(
  (bucket) => bucket.id,
);

export const toggleSelectedSongBucketIds = (
  selectedBucketIds: readonly SongBucketId[],
  bucketId: SongBucketId,
): SongBucketId[] => {
  const selected = new Set(selectedBucketIds);
  if (selected.has(bucketId)) {
    selected.delete(bucketId);
  } else {
    selected.add(bucketId);
  }

  return defaultSelectedSongBucketIds.filter((id) => selected.has(id));
};

export const normalizeSongValue = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const songSchema = z
  .object({
    id: z
      .string()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Song ids must use lowercase kebab-case.",
      ),
    title: z.string().min(1),
    artist: z.string().min(1),
    youtubeUrl: z.string().url(),
    clipStartSeconds: z.number().int().min(0).max(600),
    bucketIds: z
      .array(songBucketIdSchema)
      .min(1)
      .superRefine((bucketIds, ctx) => {
        if (new Set(bucketIds).size !== bucketIds.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "bucketIds must not contain duplicates.",
          });
        }
      }),
    quizCategoryId: songBucketIdSchema,
    difficulty: z.number().int().min(1).max(5),
    forcedOptionSongId: z.string().min(1).optional(),
  })
  .superRefine((song, ctx) => {
    if (!song.youtubeUrl.includes("youtu")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "youtubeUrl must be a YouTube URL.",
      });
    }

    if (!song.bucketIds.includes(song.quizCategoryId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quizCategoryId"],
        message: "quizCategoryId must also appear in bucketIds.",
      });
    }
  });

const songBankSchema = z
  .array(songSchema)
  .min(5)
  .superRefine((songs, ctx) => {
    const songIndexById = new Map<string, number>();
    const songIndexByCanonicalKey = new Map<string, number>();

    songs.forEach((song, index) => {
      const duplicateIdIndex = songIndexById.get(song.id);
      if (duplicateIdIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: `Song id must be unique; first used at index ${duplicateIdIndex}.`,
        });
      } else {
        songIndexById.set(song.id, index);
      }

      const canonicalKey = [
        normalizeSongValue(song.artist),
        normalizeSongValue(song.title),
      ].join("::");
      const duplicateCanonicalIndex = songIndexByCanonicalKey.get(canonicalKey);
      if (duplicateCanonicalIndex !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: `Canonical artist/title pair must be unique; first used at index ${duplicateCanonicalIndex}.`,
        });
      } else {
        songIndexByCanonicalKey.set(canonicalKey, index);
      }
    });

    songs.forEach((song, index) => {
      if (!song.forcedOptionSongId) {
        return;
      }

      if (song.forcedOptionSongId === song.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "forcedOptionSongId"],
          message: "forcedOptionSongId must reference a different song.",
        });
        return;
      }

      if (!songIndexById.has(song.forcedOptionSongId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "forcedOptionSongId"],
          message: "forcedOptionSongId must reference an existing song id.",
        });
        return;
      }

      const forcedOptionSong =
        songs[songIndexById.get(song.forcedOptionSongId)!];
      if (forcedOptionSong?.quizCategoryId !== song.quizCategoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "forcedOptionSongId"],
          message:
            "forcedOptionSongId must reference a song in the same quiz category.",
        });
      }
    });

    songBuckets.forEach((bucket) => {
      const quizCategorySongs = songs.filter(
        (song) => song.quizCategoryId === bucket.id,
      );
      const distinctTitles = new Set(
        quizCategorySongs.map((song) => normalizeSongValue(song.title)),
      );
      const distinctArtists = new Set(
        quizCategorySongs.map((song) => normalizeSongValue(song.artist)),
      );

      if (distinctTitles.size < 4 || distinctArtists.size < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Quiz category "${bucket.id}" must contain at least four distinct titles and artists.`,
        });
      }
    });
  });

export const songBank = songBankSchema.parse(songCatalog);

export type SongEntry = z.infer<typeof songSchema>;

const songById = new Map(songBank.map((song) => [song.id, song]));

export const getSongsForBuckets = (
  selectedBucketIds: readonly SongBucketId[],
): SongEntry[] => {
  const selected = new Set(selectedBucketIds);
  if (selected.size === 0) {
    return [];
  }

  return songBank.filter((song) =>
    song.bucketIds.some((bucketId) => selected.has(bucketId)),
  );
};

export const getSongsForQuizCategory = (
  quizCategoryId: SongBucketId,
): SongEntry[] => {
  return songBank.filter((song) => song.quizCategoryId === quizCategoryId);
};

export const getSongCanonicalKey = (song: SongEntry): string => {
  return [normalizeSongValue(song.artist), normalizeSongValue(song.title)].join(
    "::",
  );
};

export const getUniqueSongsForBuckets = (
  selectedBucketIds: readonly SongBucketId[],
): SongEntry[] => {
  return getSongsForBuckets(selectedBucketIds);
};

export const getUniqueSongCountForBuckets = (
  selectedBucketIds: readonly SongBucketId[],
): number => {
  return getUniqueSongsForBuckets(selectedBucketIds).length;
};

export const pickSongClipStartSeconds = (song: SongEntry): number => {
  return song.clipStartSeconds;
};

/**
 * Returns a song from the static song bank by id.
 */
export const getSongById = (songId: string): SongEntry | null => {
  return songById.get(songId) ?? null;
};
