import type { SoundManifest } from "@air-jam/sdk";

export const PONG_SOUND_MANIFEST = {
  hit: {
    src: ["/sounds/pong-hit.wav"],
    volume: 0.55,
  },
  score: {
    src: ["/sounds/pong-score.wav"],
    volume: 0.65,
  },
  start: {
    src: ["/sounds/pong-start.wav"],
    volume: 0.6,
  },
  win: {
    src: ["/sounds/pong-win.wav"],
    volume: 0.75,
  },
} satisfies SoundManifest;
