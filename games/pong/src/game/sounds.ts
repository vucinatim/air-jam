/**
 * Pong sound manifest.
 *
 * Declared once and mounted on both host (`AudioRuntime`) and controllers
 * (`ControllerRemoteAudioRuntime`). The host triggers sounds directly with
 * `audio.play(id)`, and also forwards "remote" ones to a specific controller
 * via `audio.play(id, { remote: true, target: playerId })`.
 *
 * Asset files live under `public/sounds/` and ship with the release bundle.
 */
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

export type PongSoundId = keyof typeof PONG_SOUND_MANIFEST;
