import {
  type SongCatalogEntry,
  type SongCatalogSourceEntry,
} from "../song-buckets";
import { balkanSongAdditions } from "./balkan";
import { coreSongCatalog } from "./core";
import { internationalSongAdditions } from "./international";
import { songQuizMetadataById } from "./quiz-metadata";
import { slovenianSongAdditions } from "./slovenian";

const songCatalogSource = [
  ...coreSongCatalog,
  ...slovenianSongAdditions,
  ...balkanSongAdditions,
  ...internationalSongAdditions,
] as const satisfies readonly SongCatalogSourceEntry[];

if (Object.keys(songQuizMetadataById).length !== songCatalogSource.length) {
  throw new Error(
    "Quiz metadata must contain exactly one entry for every catalog song.",
  );
}

export const songCatalog: readonly SongCatalogEntry[] = songCatalogSource.map(
  (song) => {
    const quizMetadata = songQuizMetadataById[song.id];
    if (!quizMetadata) {
      throw new Error(`Missing quiz metadata for song "${song.id}".`);
    }

    return {
      ...song,
      ...quizMetadata,
    };
  },
);
