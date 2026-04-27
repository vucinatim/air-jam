import type { SoundManifest } from "@air-jam/sdk";

export const OFFICE_SOUND_MANIFEST = {
  "task-start": {
    src: ["/sounds/task-start.mp3"],
    volume: 0.7,
  },
  "task-complete": {
    src: ["/sounds/task-complete.mp3"],
    volume: 0.7,
  },
  "new-order": {
    src: ["/sounds/new-order.mp3"],
    volume: 0.7,
  },
  "game-over": {
    src: ["/sounds/game-over.mp3"],
    volume: 0.7,
  },
  "order-timeout": {
    src: ["/sounds/order-timeout.mp3"],
    volume: 0.7,
  },
} satisfies SoundManifest;

export type OfficeSoundId = keyof typeof OFFICE_SOUND_MANIFEST;
