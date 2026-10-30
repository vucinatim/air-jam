import { defineAirJamAssets } from "@air-jam/sdk/core";

export const lastBandStandingAssets = defineAirJamAssets({
  sounds: {
    correct: {
      src: ["/sounds/correct.wav"],
      volume: 0.6,
      category: "sfx",
    },
    wrong: {
      src: ["/sounds/wrong.wav"],
      volume: 0.5,
      category: "sfx",
    },
    "countdown-tick": {
      src: ["/sounds/countdown-tick.wav"],
      volume: 0.8,
      category: "sfx",
    },
    "round-start": {
      src: ["/sounds/round-start.wav"],
      volume: 0.5,
      category: "sfx",
    },
    victory: {
      src: ["/sounds/victory.wav"],
      volume: 0.7,
      category: "sfx",
    },
  },
  images: {
    fire: {
      src: "/lottie/Fire.png",
    },
  },
  files: {
    fireAnimation: {
      src: "/lottie/Fire.json",
    },
  },
});
export type SoundId = keyof typeof lastBandStandingAssets.sounds;
