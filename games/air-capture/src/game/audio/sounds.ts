import type { SoundManifest } from "@air-jam/sdk";

export const HOST_SFX_MANIFEST = {
  engine_idle: {
    src: ["/sounds/engine_idle.wav"],
    volume: 0.3,
    loop: true,
  },
  engine_thrust: {
    src: ["/sounds/engine_idle.wav"],
    volume: 0.5,
    loop: true,
  },
  laser_fire: {
    src: ["/sounds/laser_blast.wav"],
    volume: 0.4,
  },
  explosion: {
    src: ["/sounds/ship_explosion.wav"],
    volume: 0.7,
  },
  hit: {
    src: ["/sounds/laser_hit.wav"],
    volume: 0.5,
  },
  pickup_flag: {
    src: ["/sounds/flag_pickup.wav"],
    volume: 0.8,
  },
  score_point: {
    src: ["/sounds/score_point.wav"],
    volume: 1.0,
  },
  touch_base: {
    src: ["/sounds/touch_base.wav"],
    volume: 0.6,
  },
  jump_pad: {
    src: ["/sounds/jump_pad.wav"],
    volume: 0.3,
  },
  powerup: {
    src: ["/sounds/collectible_pickup.wav"],
    volume: 0.6,
  },
  rocket_launch: {
    src: ["/sounds/rocket_launch.wav"],
    volume: 0.6,
  },
  rocket_explosion: {
    src: ["/sounds/rocket_explosion.wav"],
    volume: 0.7,
  },
  health_pack: {
    src: ["/sounds/use_healthpack.wav"],
    volume: 0.6,
  },
  speed_boost: {
    src: ["/sounds/speed_up.wav"],
    volume: 0.6,
  },
  player_join: {
    src: ["/sounds/player_join.wav"],
    volume: 0.6,
  },
  success: {
    src: ["/sounds/success.wav"],
    volume: 0.6,
  },
} satisfies SoundManifest;

export const HOST_MUSIC_MANIFEST = {
  bgm_track_1: {
    src: ["/music/track_1.mp3"],
    volume: 0.4,
    html5: true,
    category: "music",
  },
  bgm_track_2: {
    src: ["/music/track_2.mp3"],
    volume: 0.4,
    html5: true,
    category: "music",
  },
  bgm_track_3: {
    src: ["/music/track_3.mp3"],
    volume: 0.4,
    html5: true,
    category: "music",
  },
  bgm_track_4: {
    src: ["/music/track_4.mp3"],
    volume: 0.4,
    html5: true,
    category: "music",
  },
} satisfies SoundManifest;

export const HOST_AUDIO_MANIFEST = {
  ...HOST_SFX_MANIFEST,
  ...HOST_MUSIC_MANIFEST,
} satisfies SoundManifest;

export const CONTROLLER_SOUND_MANIFEST = {
  click: {
    src: ["/sounds/button_click.wav"],
    volume: 0.5,
  },
  action: {
    src: ["/sounds/button_click.wav"],
    volume: 0.6,
  },
  error: {
    src: ["/sounds/error.wav"],
    volume: 0.5,
  },
  success: {
    src: ["/sounds/success.wav"],
    volume: 0.6,
  },
  engine: {
    src: ["/sounds/engine_idle.wav"],
    volume: 0.4,
    loop: true,
  },
  laser: {
    src: ["/sounds/laser_blast.wav"],
    volume: 0.3,
  },
} satisfies SoundManifest;

export const HOST_MUSIC_TRACKS = [
  "bgm_track_1",
  "bgm_track_2",
  "bgm_track_3",
  "bgm_track_4",
] as const;

export type HostSfxId = keyof typeof HOST_SFX_MANIFEST;
export type HostMusicId = keyof typeof HOST_MUSIC_MANIFEST;
export type HostAudioId = keyof typeof HOST_AUDIO_MANIFEST;
export type ControllerSoundId = keyof typeof CONTROLLER_SOUND_MANIFEST;
