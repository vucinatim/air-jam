import { type SongCatalogEntry } from "../song-buckets";
import { balkanSongAdditions } from "./balkan";
import { coreSongCatalog } from "./core";
import { internationalSongAdditions } from "./international";
import { slovenianSongAdditions } from "./slovenian";

export const songCatalog = [
  ...coreSongCatalog,
  ...slovenianSongAdditions,
  ...balkanSongAdditions,
  ...internationalSongAdditions,
] as const satisfies readonly SongCatalogEntry[];
