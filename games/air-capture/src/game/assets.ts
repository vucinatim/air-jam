import { defineAirJamAssets } from "@air-jam/sdk/core";

export const airCaptureAssets = defineAirJamAssets({
  sounds: {
    engine_idle: {
      src: ["/sounds/engine_idle.wav"],
      volume: 0.3,
      loop: true,
      surface: "host",
    },
    engine_thrust: {
      src: ["/sounds/engine_idle.wav"],
      volume: 0.5,
      loop: true,
      surface: "host",
    },
    laser_fire: {
      src: ["/sounds/laser_blast.wav"],
      volume: 0.4,
      surface: "host",
    },
    explosion: {
      src: ["/sounds/ship_explosion.wav"],
      volume: 0.7,
      surface: "host",
    },
    hit: {
      src: ["/sounds/laser_hit.wav"],
      volume: 0.5,
      surface: "host",
    },
    pickup_flag: {
      src: ["/sounds/flag_pickup.wav"],
      volume: 0.8,
      surface: "host",
    },
    score_point: {
      src: ["/sounds/score_point.wav"],
      volume: 1,
      surface: "host",
    },
    touch_base: {
      src: ["/sounds/touch_base.wav"],
      volume: 0.6,
      surface: "host",
    },
    jump_pad: {
      src: ["/sounds/jump_pad.wav"],
      volume: 0.3,
      surface: "host",
    },
    powerup: {
      src: ["/sounds/collectible_pickup.wav"],
      volume: 0.6,
      surface: "host",
    },
    rocket_launch: {
      src: ["/sounds/rocket_launch.wav"],
      volume: 0.6,
      surface: "host",
    },
    rocket_explosion: {
      src: ["/sounds/rocket_explosion.wav"],
      volume: 0.7,
      surface: "host",
    },
    health_pack: {
      src: ["/sounds/use_healthpack.wav"],
      volume: 0.6,
      surface: "host",
    },
    speed_boost: {
      src: ["/sounds/speed_up.wav"],
      volume: 0.6,
      surface: "host",
    },
    player_join: {
      src: ["/sounds/player_join.wav"],
      volume: 0.6,
      surface: "host",
    },
    success: {
      src: ["/sounds/success.wav"],
      volume: 0.6,
    },
    bgm_track_1: {
      src: ["/music/track_1.mp3"],
      volume: 0.4,
      html5: true,
      category: "music",
      surface: "host",
    },
    bgm_track_2: {
      src: ["/music/track_2.mp3"],
      volume: 0.4,
      html5: true,
      category: "music",
      surface: "host",
    },
    bgm_track_3: {
      src: ["/music/track_3.mp3"],
      volume: 0.4,
      html5: true,
      category: "music",
      surface: "host",
    },
    bgm_track_4: {
      src: ["/music/track_4.mp3"],
      volume: 0.4,
      html5: true,
      category: "music",
      surface: "host",
    },
    click: {
      src: ["/sounds/button_click.wav"],
      volume: 0.5,
      surface: "controller",
    },
    action: {
      src: ["/sounds/button_click.wav"],
      volume: 0.6,
      surface: "controller",
    },
    error: {
      src: ["/sounds/error.wav"],
      volume: 0.5,
      surface: "controller",
    },
    engine: {
      src: ["/sounds/engine_idle.wav"],
      volume: 0.4,
      loop: true,
      surface: "controller",
    },
    laser: {
      src: ["/sounds/laser_blast.wav"],
      volume: 0.3,
      surface: "controller",
    },
  },
  images: {
    healthPack: {
      src: "/images/ability-icons/health_pack.png",
    },
    speedBoost: {
      src: "/images/ability-icons/speed_boost.png",
    },
    rocket: {
      src: "/images/ability-icons/rocket.png",
    },
  },
  files: {},
});
type Sounds = typeof airCaptureAssets.sounds;
export const HOST_MUSIC_TRACKS = [
  "bgm_track_1",
  "bgm_track_2",
  "bgm_track_3",
  "bgm_track_4",
] as const;
export type HostMusicId = (typeof HOST_MUSIC_TRACKS)[number];
export type HostAudioId = {
  [Key in keyof Sounds]: Sounds[Key] extends { surface: "controller" }
    ? never
    : Key;
}[keyof Sounds];
export type HostSfxId = Exclude<HostAudioId, HostMusicId>;
export type ControllerSoundId = {
  [Key in keyof Sounds]: Sounds[Key] extends { surface: "host" } ? never : Key;
}[keyof Sounds];
