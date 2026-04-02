import { z } from "zod";
import { shuffleList } from "./utils/shuffle";
import { type RoundGuessKind } from "./types";

const songSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    artist: z.string().min(1),
    youtubeUrl: z.string().url(),
    forcedOptionSongId: z.string().min(1).optional(),
  })
  .superRefine((song, ctx) => {
    if (!song.youtubeUrl.includes("youtu")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "youtubeUrl must be a YouTube URL.",
      });
    }
  });

const songBankSchema = z
  .array(songSchema)
  .min(5)
  .superRefine((songs, ctx) => {
    const uniqueSongIds = new Set(songs.map((song) => song.id));

    if (uniqueSongIds.size !== songs.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Song ids must be unique.",
      });
    }

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

      if (!uniqueSongIds.has(song.forcedOptionSongId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "forcedOptionSongId"],
          message: "forcedOptionSongId must reference an existing song id.",
        });
      }
    });
  });

const rawSongBank = [
  {
    id: "bohemian-rhapsody",
    title: "Bohemian Rhapsody",
    artist: "Queen",
    youtubeUrl: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
  },
  {
    id: "take-on-me",
    title: "Take On Me",
    artist: "a-ha",
    youtubeUrl: "https://www.youtube.com/watch?v=djV11Xbc914",
  },
  {
    id: "smells-like-teen-spirit",
    title: "Smells Like Teen Spirit",
    artist: "Nirvana",
    youtubeUrl: "https://www.youtube.com/watch?v=hTWKbfoikeg",
  },
  {
    id: "billie-jean",
    title: "Billie Jean",
    artist: "Michael Jackson",
    youtubeUrl: "https://www.youtube.com/watch?v=Zi_XLOBDo_Y",
  },
  {
    id: "rolling-in-the-deep",
    title: "Rolling In The Deep",
    artist: "Adele",
    youtubeUrl: "https://www.youtube.com/watch?v=rYEDA3JcQqw",
  },
  {
    id: "blinding-lights",
    title: "Blinding Lights",
    artist: "The Weeknd",
    youtubeUrl: "https://www.youtube.com/watch?v=4NRXx6U8ABQ",
  },
  {
    id: "bad-guy",
    title: "bad guy",
    artist: "Billie Eilish",
    youtubeUrl: "https://www.youtube.com/watch?v=DyDfgMOUjCI",
  },
  {
    id: "bara-bada-bastu",
    title: "Bara Bada Bastu",
    artist: "KAJ",
    youtubeUrl: "https://www.youtube.com/watch?v=QOehBj0nCMU",
  },
  {
    id: "berghain",
    title: "Berghain",
    artist: "ROSALIA",
    youtubeUrl: "https://www.youtube.com/watch?v=htQBS2Ikz6c&t=26",
  },
  {
    id: "francesca",
    title: "Francesca",
    artist: "Hozier",
    youtubeUrl: "https://www.youtube.com/watch?v=K1u_hL11auM&t=13",
  },
  {
    id: "runaway",
    title: "Runaway",
    artist: "Kanye West",
    youtubeUrl: "https://www.youtube.com/watch?v=cv1naUa3_3g",
  },
  {
    id: "moja-treba",
    title: "Moja treba",
    artist: "Ajkule",
    youtubeUrl: "https://www.youtube.com/watch?v=RgRfmL73qzU",
  },
  {
    id: "najjaci-si",
    title: "NAJJACI SI",
    artist: "MIKIC",
    youtubeUrl: "https://www.youtube.com/watch?v=MdxGibK0S4A",
  },
  {
    id: "the-7th-element",
    title: "The 7th Element",
    artist: "Vitas",
    youtubeUrl: "https://www.youtube.com/watch?v=989-7xsRLR4",
  },
  {
    id: "zmija-i-zaba",
    title: "Zmija i zaba",
    artist: "Oskar i Slavica Cukteras",
    youtubeUrl: "https://www.youtube.com/watch?v=8hczXIpeZqI",
  },
  {
    id: "aspirin",
    title: "Aspirin",
    artist: "Seka",
    youtubeUrl: "https://www.youtube.com/watch?v=gH0xuHo8x0g",
  },
  {
    id: "koktel-ljubavi",
    title: "Koktel ljubavi",
    artist: "Nedeljko Bajic Baja",
    youtubeUrl: "https://www.youtube.com/watch?v=ZM5CuiuGkaA",
  },
  {
    id: "kuku-lele",
    title: "Kuku Lele",
    artist: "Magnifico",
    youtubeUrl: "https://www.youtube.com/watch?v=AmByNZfSYZI",
  },
  {
    id: "barbie-and-ken",
    title: "Barbie & Ken",
    artist: "MIKIC",
    youtubeUrl: "https://www.youtube.com/watch?v=mWX0eKTiHcY",
  },
  {
    id: "silvo",
    title: "Silvo",
    artist: "KOKOSY",
    youtubeUrl: "https://www.youtube.com/watch?v=IUyHxk9afs8",
  },
  {
    id: "youre-beautiful-but-its-groan-tube",
    title: "You're Beautiful",
    artist: "Groan Tube",
    youtubeUrl: "https://www.youtube.com/watch?v=2vlO40rDw0s",
  },
  {
    id: "london-song",
    title: "London Song",
    artist: "Ninajirachi",
    youtubeUrl: "https://www.youtube.com/watch?v=mra_6tIHLYg",
  },
  {
    id: "kej-si",
    title: "Kej si",
    artist: "Generator",
    youtubeUrl: "https://www.youtube.com/watch?v=ooGHONDhFPQ&t=10",
  },
  {
    id: "creva-na-plot",
    title: "Creva na plot",
    artist: "Slon in Sadez",
    youtubeUrl: "https://www.youtube.com/watch?v=5w5m8lYMJoo",
  },
  {
    id: "all-my-friends-are-dead",
    title: "All My Friends Are Dead",
    artist: "MRFY",
    youtubeUrl: "https://www.youtube.com/watch?v=GfCDwegih70",
    forcedOptionSongId: "prjatucki",
  },
  {
    id: "prjatucki",
    title: "Prjatucki ♥",
    artist: "MRFY",
    youtubeUrl: "https://www.youtube.com/watch?v=yZZtyN_EfK8",
    forcedOptionSongId: "all-my-friends-are-dead",
  },
  {
    id: "never-gonna-give-you-up",
    title: "Never Gonna Give You Up",
    artist: "Rick Astley",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "ppap",
    title: "PPAP (Pen Pineapple Apple Pen)",
    artist: "PIKOTARO",
    youtubeUrl: "https://www.youtube.com/watch?v=Ct6BUPvE2sM",
  },
  {
    id: "sandstorm",
    title: "Sandstorm",
    artist: "Darude",
    youtubeUrl: "https://www.youtube.com/watch?v=y6120QOlsfU",
  },
  {
    id: "crab-rave",
    title: "Crab Rave",
    artist: "Noisestorm",
    youtubeUrl: "https://www.youtube.com/watch?v=_upPCdWq11k",
  },
  {
    id: "running-in-the-90s",
    title: "Running In The 90s",
    artist: "Max Coveri",
    youtubeUrl: "https://www.youtube.com/watch?v=kxLwGow0Tvw",
  },
  {
    id: "scatman",
    title: "Scatman (Ski-Ba-Bop-Ba-Dop-Bop)",
    artist: "Scatman John",
    youtubeUrl: "https://www.youtube.com/watch?v=Hy8kmNEo1i8",
  },
  {
    id: "baby-im-yours",
    title: "Baby I'm Yours",
    artist: "Breakbot feat. Irfane",
    youtubeUrl: "https://www.youtube.com/watch?v=6okxuiiHx2w",
  },
  {
    id: "coffin-dance",
    title: "Coffin Dance",
    artist: "Vicetone & Tony Igy",
    youtubeUrl: "https://www.youtube.com/watch?v=j9V78UbdzWI",
  },
  {
    id: "buttercup",
    title: "Buttercup",
    artist: "Jack Stauber",
    youtubeUrl: "https://www.youtube.com/watch?v=eYDI8b5Nn5s",
  },
  {
    id: "jerk-it-out",
    title: "Jerk It Out",
    artist: "Caesars Palace",
    youtubeUrl: "https://www.youtube.com/watch?v=w869Avr_fXI",
  },
  {
    id: "all-star",
    title: "All Star",
    artist: "Smash Mouth",
    youtubeUrl: "https://www.youtube.com/watch?v=L_jWHffIx5E",
  },
  {
    id: "lemon-tree",
    title: "Lemon Tree",
    artist: "Fools Garden",
    youtubeUrl: "https://www.youtube.com/watch?v=Va0vs1fhhNI",
  },
  {
    id: "ymca",
    title: "YMCA",
    artist: "Village People",
    youtubeUrl: "https://www.youtube.com/watch?v=CS9OO0S5w2k",
  },
  {
    id: "gangnam-style",
    title: "Gangnam Style",
    artist: "PSY",
    youtubeUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
  },
  {
    "id": "Bohemian Rhapsody-Queen",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "youtubeUrl": "https://youtu.be/fJ9rUzIMcZQ"
  },
  {
    "id": "Dancing Queen-ABBA",
    "title": "Dancing Queen",
    "artist": "ABBA",
    "youtubeUrl": "https://youtu.be/xFrGuyw1V8s"
  },
  {
    "id": "Stayin' Alive-Bee Gees",
    "title": "Stayin' Alive",
    "artist": "Bee Gees",
    "youtubeUrl": "https://youtu.be/I_izvAbhExY"
  },
  {
    "id": "September-Earth, Wind & Fire",
    "title": "September",
    "artist": "Earth, Wind & Fire",
    "youtubeUrl": "https://youtu.be/Gs069dndIYk"
  },
  {
    "id": "Dreams-Fleetwood Mac",
    "title": "Dreams",
    "artist": "Fleetwood Mac",
    "youtubeUrl": "https://youtu.be/Y3ywicSN8HE"
  },
  {
    "id": "I Will Survive-Gloria Gaynor",
    "title": "I Will Survive",
    "artist": "Gloria Gaynor",
    "youtubeUrl": "https://youtu.be/gYkACVDFmeg"
  },
  {
    "id": "Rocket Man-Elton John",
    "title": "Rocket Man",
    "artist": "Elton John",
    "youtubeUrl": "https://youtu.be/DtVBCG6ThDk"
  },
  {
    "id": "Thriller-Michael Jackson",
    "title": "Thriller",
    "artist": "Michael Jackson",
    "youtubeUrl": "https://youtu.be/sOnqjkJTMaA?t=258"
  },
  {
    "id": "Take On Me-a-ha",
    "title": "Take On Me",
    "artist": "a-ha",
    "youtubeUrl": "https://youtu.be/djV11Xbc914?t=22"
  },
  {
    "id": "Never Gonna Give You Up-Rick Astley",
    "title": "Never Gonna Give You Up",
    "artist": "Rick Astley",
    "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ"
  },
  {
    "id": "I Wanna Dance With Somebody-Whitney Houston",
    "title": "I Wanna Dance With Somebody",
    "artist": "Whitney Houston",
    "youtubeUrl": "https://youtu.be/eH3giaIzONA?t=23"
  },
  {
    "id": "Girls Just Want To Have Fun-Cyndi Lauper",
    "title": "Girls Just Want To Have Fun",
    "artist": "Cyndi Lauper",
    "youtubeUrl": "https://youtu.be/PIb6AZdTr-A?t=31"
  },
  {
    "id": "Like A Prayer-Madonna",
    "title": "Like A Prayer",
    "artist": "Madonna",
    "youtubeUrl": "https://youtu.be/79fzeNUqQbQ?t=25"
  },
  {
    "id": "Don't Stop Believin'-Journey",
    "title": "Don't Stop Believin'",
    "artist": "Journey",
    "youtubeUrl": "https://youtu.be/1k8craCGv14"
  },
  {
    "id": "Smells Like Teen Spirit-Nirvana",
    "title": "Smells Like Teen Spirit",
    "artist": "Nirvana",
    "youtubeUrl": "https://youtu.be/hTWKbfoikeg"
  },
  {
    "id": "Wonderwall-Oasis",
    "title": "Wonderwall",
    "artist": "Oasis",
    "youtubeUrl": "https://youtu.be/bx1Bh8ZvH84"
  },
  {
    "id": "Wannabe-Spice Girls",
    "title": "Wannabe",
    "artist": "Spice Girls",
    "youtubeUrl": "https://youtu.be/gJLIiF15wjQ?t=28"
  },
  {
    "id": "No Scrubs-TLC",
    "title": "No Scrubs",
    "artist": "TLC",
    "youtubeUrl": "https://youtu.be/FrLtePxc4ZU?t=26"
  },
  {
    "id": "...Baby One More Time-Britney Spears",
    "title": "...Baby One More Time",
    "artist": "Britney Spears",
    "youtubeUrl": "https://youtu.be/C-u5WLJ9Yk4?t=15"
  },
  {
    "id": "I Want It That Way-Backstreet Boys",
    "title": "I Want It That Way",
    "artist": "Backstreet Boys",
    "youtubeUrl": "https://youtu.be/4fndeDfaWCg"
  },
  {
    "id": "Creep-Radiohead",
    "title": "Creep",
    "artist": "Radiohead",
    "youtubeUrl": "https://youtu.be/XFkzRNyygfk"
  },
  {
    "id": "Hey Ya!-Outkast",
    "title": "Hey Ya!",
    "artist": "Outkast",
    "youtubeUrl": "https://youtu.be/PWgvGjAhvIw?t=48"
  },
  {
    "id": "Mr. Brightside-The Killers",
    "title": "Mr. Brightside",
    "artist": "The Killers",
    "youtubeUrl": "https://youtu.be/gGdGFtwCNBE"
  },
  {
    "id": "Crazy In Love-Beyoncé",
    "title": "Crazy In Love",
    "artist": "Beyoncé",
    "youtubeUrl": "https://youtu.be/ViwtNLUqkMY"
  },
  {
    "id": "Lose Yourself-Eminem",
    "title": "Lose Yourself",
    "artist": "Eminem",
    "youtubeUrl": "https://youtu.be/_Yhyp-_hX2s"
  },
  {
    "id": "Viva La Vida-Coldplay",
    "title": "Viva La Vida",
    "artist": "Coldplay",
    "youtubeUrl": "https://youtu.be/dvgZkm1xWPE"
  },
  {
    "id": "Bad Romance-Lady Gaga",
    "title": "Bad Romance",
    "artist": "Lady Gaga",
    "youtubeUrl": "https://youtu.be/qrO4YZeyl0I?t=37"
  },
  {
    "id": "Umbrella-Rihanna",
    "title": "Umbrella",
    "artist": "Rihanna",
    "youtubeUrl": "https://youtu.be/CvBfHwUxHIk"
  },
  {
    "id": "Rolling in the Deep-Adele",
    "title": "Rolling in the Deep",
    "artist": "Adele",
    "youtubeUrl": "https://youtu.be/rYEDA3JcQqw"
  },
  {
    "id": "Uptown Funk-Mark Ronson ft. Bruno Mars",
    "title": "Uptown Funk",
    "artist": "Mark Ronson ft. Bruno Mars",
    "youtubeUrl": "https://youtu.be/OPf0YbXqDm0?t=16"
  },
  {
    "id": "Shape of You-Ed Sheeran",
    "title": "Shape of You",
    "artist": "Ed Sheeran",
    "youtubeUrl": "https://youtu.be/JGwWNGJdvx8"
  },
  {
    "id": "Despacito-Luis Fonsi",
    "title": "Despacito",
    "artist": "Luis Fonsi",
    "youtubeUrl": "https://youtu.be/kJQP7kiw5Fk?t=19"
  },
  {
    "id": "Blank Space-Taylor Swift",
    "title": "Blank Space",
    "artist": "Taylor Swift",
    "youtubeUrl": "https://youtu.be/e-ORhEE9VVg?t=25"
  },
  {
    "id": "bad guy-Billie Eilish",
    "title": "bad guy",
    "artist": "Billie Eilish",
    "youtubeUrl": "https://youtu.be/DyDfgMOUjCI?t=17"
  },
  {
    "id": "Blinding Lights-The Weeknd",
    "title": "Blinding Lights",
    "artist": "The Weeknd",
    "youtubeUrl": "https://youtu.be/4NRXx6U8ABQ?t=24"
  },
  {
    "id": "Levitating-Dua Lipa",
    "title": "Levitating",
    "artist": "Dua Lipa",
    "youtubeUrl": "https://youtu.be/TUVcZfQe-Kw"
  },
  {
    "id": "As It Was-Harry Styles",
    "title": "As It Was",
    "artist": "Harry Styles",
    "youtubeUrl": "https://youtu.be/H5v3kku4y6Q"
  },
  {
    "id": "Flowers-Miley Cyrus",
    "title": "Flowers",
    "artist": "Miley Cyrus",
    "youtubeUrl": "https://youtu.be/G7KNmW9a75Y"
  },
  {
    "id": "drivers license-Olivia Rodrigo",
    "title": "drivers license",
    "artist": "Olivia Rodrigo",
    "youtubeUrl": "https://youtu.be/ZmDBbnmKpqQ"
  },
  {
    "id": "Kill Bill-SZA",
    "title": "Kill Bill",
    "artist": "SZA",
    "youtubeUrl": "https://youtu.be/SQnc1QibapQ?t=35"
  },
] as const;

export const songBank = songBankSchema.parse(rawSongBank);

export type SongEntry = z.infer<typeof songSchema>;

const songById = new Map(songBank.map((song) => [song.id, song]));

/**
 * Returns a song from the static song bank by id.
 */
export const getSongById = (songId: string): SongEntry | null => {
  return songById.get(songId) ?? null;
};

const normalizeLabel = (value: string): string => value.trim().toLowerCase();

/**
 * Returns the label used for an option based on the round guess kind.
 */
export const getRoundOptionLabel = (
  song: SongEntry,
  guessKind: RoundGuessKind,
): string => {
  return guessKind === "artist" ? song.artist : song.title;
};

/**
 * Creates a randomized option list with one correct song id and distractors.
 */
export const pickRoundOptionSongIds = (
  correctSongId: string,
  optionCount: number,
  guessKind: RoundGuessKind,
): string[] => {
  const correctSong = songById.get(correctSongId);
  if (!correctSong) {
    throw new Error(`Unknown song id: ${correctSongId}`);
  }

  if (optionCount < 2) {
    throw new Error("optionCount must be at least 2.");
  }

  const distractorCount = optionCount - 1;
  const forcedDistractorId = correctSong.forcedOptionSongId;
  const forcedDistractorSong =
    forcedDistractorId !== undefined ? songById.get(forcedDistractorId) : null;

  if (forcedDistractorId && !forcedDistractorSong) {
    throw new Error(
      `Forced option song id "${forcedDistractorId}" for "${correctSongId}" does not exist.`,
    );
  }

  const distractorPool = songBank
    .map((song) => song.id)
    .filter((songId) => songId !== correctSongId && songId !== forcedDistractorId);

  if (distractorPool.length < distractorCount) {
    throw new Error(
      `Not enough songs to build ${optionCount} options (have ${distractorPool.length + 1}).`,
    );
  }

  const shuffledDistractorIds = shuffleList(distractorPool);
  const selectedDistractorIds: string[] = [];
  const selectedDistractorIdSet = new Set<string>();
  const usedLabels = new Set<string>([
    normalizeLabel(getRoundOptionLabel(correctSong, guessKind)),
  ]);

  if (forcedDistractorSong && selectedDistractorIds.length < distractorCount) {
    selectedDistractorIds.push(forcedDistractorSong.id);
    selectedDistractorIdSet.add(forcedDistractorSong.id);
    usedLabels.add(normalizeLabel(getRoundOptionLabel(forcedDistractorSong, guessKind)));
  }

  shuffledDistractorIds.forEach((distractorId) => {
    if (selectedDistractorIds.length >= distractorCount) {
      return;
    }

    const distractorSong = songById.get(distractorId);
    if (!distractorSong) {
      return;
    }

    const distractorLabel = normalizeLabel(getRoundOptionLabel(distractorSong, guessKind));

    if (usedLabels.has(distractorLabel)) {
      return;
    }

    selectedDistractorIds.push(distractorId);
    selectedDistractorIdSet.add(distractorId);
    usedLabels.add(distractorLabel);
  });

  if (selectedDistractorIds.length < distractorCount) {
    shuffledDistractorIds.forEach((distractorId) => {
      if (selectedDistractorIds.length >= distractorCount) {
        return;
      }

      if (selectedDistractorIdSet.has(distractorId)) {
        return;
      }

      selectedDistractorIds.push(distractorId);
      selectedDistractorIdSet.add(distractorId);
    });
  }

  const distractorIds = selectedDistractorIds.slice(0, distractorCount);
  return shuffleList([correctSongId, ...distractorIds]);
};
