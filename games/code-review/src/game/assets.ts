import { defineAirJamAssets } from "@air-jam/sdk/core";

export const codeReviewAssets = defineAirJamAssets({
  sounds: {
    crowd: {
      src: ["/sounds/crowd.mp3"],
      volume: 0.28,
      html5: true,
      category: "music",
      surface: "host",
    },
    bell: {
      src: ["/sounds/bell.mp3"],
      volume: 1,
      surface: "host",
    },
    hit1: {
      src: ["/sounds/hit1.mp3"],
      volume: 1,
      surface: "host",
    },
    hit2: {
      src: ["/sounds/hit2.mp3"],
      volume: 1,
      surface: "host",
    },
    missed: {
      src: ["/sounds/missed.mp3"],
      volume: 1,
      surface: "host",
    },
  },
  images: {
    defend: {
      src: "/sprites/defend.png",
    },
    end: {
      src: "/sprites/end.png",
    },
    leftExtended: {
      src: "/sprites/left-extended.png",
    },
    leftShort: {
      src: "/sprites/left-short.png",
    },
    rightExtended: {
      src: "/sprites/right-extended.png",
    },
    rightShort: {
      src: "/sprites/right-short.png",
    },
  },
  files: {},
});
export const CODE_REVIEW_MUSIC_TRACKS = ["crowd"] as const;

export type CodeReviewSoundId = keyof typeof codeReviewAssets.sounds;
export type CodeReviewSfxId = Exclude<CodeReviewSoundId, "crowd">;
