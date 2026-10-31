import { defineAirJamAssets } from "@air-jam/sdk/core";

export const pongAssets = defineAirJamAssets({
  sounds: {
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
  },
  images: {},
  files: {},
});
export type PongSoundId = keyof typeof pongAssets.sounds;
