export const songBuckets = [
  { id: "global-pop", label: "Global Pop" },
  { id: "meme", label: "Meme" },
  { id: "slovenian", label: "Slovenian" },
  { id: "balkan", label: "Balkan" },
  { id: "rock-classics", label: "Rock / Classics" },
  { id: "throwbacks", label: "Throwbacks" },
  { id: "2000s", label: "2000s" },
  { id: "2010s", label: "2010s" },
  { id: "eurovision", label: "Eurovision" },
  { id: "dance-edm", label: "Dance / EDM" },
] as const;

export type SongBucketId = (typeof songBuckets)[number]["id"];

export interface SongCatalogEntry {
  id: string;
  title: string;
  artist: string;
  youtubeUrl: string;
  clipStartSeconds: number;
  bucketIds: readonly SongBucketId[];
  forcedOptionSongId?: string;
}
