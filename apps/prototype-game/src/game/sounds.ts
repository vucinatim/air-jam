import { SoundManifest } from "@air-jam/sdk";

export const SOUND_MANIFEST = {
  // Game Sounds - Engines
  engine_idle: {
    src: ["/sounds/engine_idle.wav"],
    volume: 0.3,
    loop: true,
  },
  engine_thrust: {
    src: ["/sounds/engine_idle.wav"], // Reusing idle for now, pitch/volume handled by code
    volume: 0.5,
    loop: true,
  },

  // Game Sounds - Combat
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

  // Game Sounds - Gameplay
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

  // Game Sounds - New Sounds
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

  // Controller Sounds
  click: {
    src: ["/sounds/button_click.wav"],
    volume: 0.5,
  },
  action: {
    src: ["/sounds/button_click.wav"], // Using click for generic action for now
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

  // Background Music
  bgm_track_1: {
    src: ["/music/track_1.mp3"],
    volume: 0.4,
    loop: true,
    html5: true, // Use HTML5 audio for better music playback
  },
  bgm_track_2: {
    src: ["/music/track_2.mp3"],
    volume: 0.4,
    loop: true,
    html5: true,
  },
  bgm_track_3: {
    src: ["/music/track_3.mp3"],
    volume: 0.4,
    loop: true,
    html5: true,
  },
  bgm_track_4: {
    src: ["/music/track_4.mp3"],
    volume: 0.4,
    loop: true,
    html5: true,
  },
} satisfies SoundManifest;

export type SoundId = keyof typeof SOUND_MANIFEST;
