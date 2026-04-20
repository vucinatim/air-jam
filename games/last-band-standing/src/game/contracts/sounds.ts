import type { SoundManifest } from "@air-jam/sdk";

export const soundManifest = {
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
    volume: 0.3,
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
} as const satisfies SoundManifest;

export type SoundId = keyof typeof soundManifest;
