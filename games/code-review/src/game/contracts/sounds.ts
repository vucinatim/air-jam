import type { SoundManifest } from "@air-jam/sdk";

export const CODE_REVIEW_SOUND_MANIFEST = {
  crowd: {
    src: ["/sounds/crowd.mp3"],
    volume: 0.28,
    html5: true,
    category: "music",
  },
  bell: {
    src: ["/sounds/bell.mp3"],
    volume: 1,
  },
  hit1: {
    src: ["/sounds/hit1.mp3"],
    volume: 1,
  },
  hit2: {
    src: ["/sounds/hit2.mp3"],
    volume: 1,
  },
  missed: {
    src: ["/sounds/missed.mp3"],
    volume: 1,
  },
} satisfies SoundManifest;

export const CODE_REVIEW_MUSIC_TRACKS = ["crowd"] as const;

export type CodeReviewSoundId = keyof typeof CODE_REVIEW_SOUND_MANIFEST;
export type CodeReviewSfxId = Exclude<CodeReviewSoundId, "crowd">;
