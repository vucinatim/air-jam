import {
  type PlatformAudioSettings,
  type AudioHandle,
  type PlayOptions,
  getEffectiveAudioVolume,
} from "@air-jam/sdk";
import {
  HOST_MUSIC_MANIFEST,
  HOST_MUSIC_TRACKS,
  type HostMusicId,
  type HostSfxId,
} from "./sounds";

const MUSIC_CYCLE_DURATION_MS = 180000;

type HostAudioDriver = Pick<
  AudioHandle<HostSfxId>,
  "init" | "isMuted" | "mute" | "play" | "stop"
>;

interface HostMusicDriver {
  applyPlatformAudioSettings(settings: PlatformAudioSettings): void;
  destroy(): void;
  play(trackId: HostMusicId): Promise<boolean>;
  setMuted(muted: boolean): void;
  stop(trackId?: HostMusicId): void;
}

export interface HostAudioFacade {
  init(): Promise<boolean>;
  isMuted(): boolean;
  mute(muted: boolean): void;
  play(id: HostSfxId, options?: PlayOptions): number | null;
  stop(id?: HostSfxId, soundId?: number): void;
}

export interface RotatingMusicPlayback {
  dispose(): void;
  sync(enabled: boolean): void;
}

export function createHostAudioFacade(audio: HostAudioDriver): HostAudioFacade {
  return {
    init: () => audio.init(),
    isMuted: () => audio.isMuted(),
    mute: (muted) => audio.mute(muted),
    play: (id, options) => audio.play(id, options),
    stop: (id, soundId) => audio.stop(id, soundId),
  };
}

export function createRotatingMusicPlayback(
  audio: HostMusicDriver,
  options?: {
    cycleDurationMs?: number;
    tracks?: readonly HostMusicId[];
  },
): RotatingMusicPlayback {
  const cycleDurationMs = options?.cycleDurationMs ?? MUSIC_CYCLE_DURATION_MS;
  const tracks = options?.tracks ?? HOST_MUSIC_TRACKS;
  let enabled = false;
  let currentTrackIndex = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const stopAll = () => {
    tracks.forEach((track) => {
      audio.stop(track);
    });
  };

  const schedule = (callback: () => void, delayMs: number) => {
    clearTimer();
    timer = setTimeout(callback, delayMs);
  };

  const playCurrentTrack = () => {
    if (!enabled) {
      return;
    }

    const trackId = tracks[currentTrackIndex];
    stopAll();
    void audio.play(trackId).then((started) => {
      if (!started || !enabled) {
        return;
      }

      schedule(() => {
        currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
        playCurrentTrack();
      }, cycleDurationMs);
    });
  };

  return {
    sync(nextEnabled) {
      if (!nextEnabled) {
        enabled = false;
        clearTimer();
        stopAll();
        return;
      }

      if (enabled) {
        return;
      }

      enabled = true;
      playCurrentTrack();
    },
    dispose() {
      enabled = false;
      clearTimer();
      stopAll();
    },
  };
}

export function createHostMusicDriver(
  createAudioElement: (src: string) => HTMLAudioElement = (src) =>
    new Audio(src),
): HostMusicDriver {
  const elements = new Map<HostMusicId, HTMLAudioElement>();
  let muted = false;
  let audioSettings: PlatformAudioSettings = {
    masterVolume: 1,
    musicVolume: 0.8,
    sfxVolume: 1,
  };

  const ensureTrack = (trackId: HostMusicId) => {
    let element = elements.get(trackId);
    if (!element) {
      const config = HOST_MUSIC_MANIFEST[trackId];
      element = createAudioElement(config.src[0]);
      element.loop = true;
      element.preload = "none";
      element.muted = muted;
      element.volume =
        (config.volume ?? 1) *
        getEffectiveAudioVolume(audioSettings, "music");
      elements.set(trackId, element);
    }
    return element;
  };

  return {
    applyPlatformAudioSettings(settings) {
      audioSettings = settings;
      elements.forEach((element, trackId) => {
        const config = HOST_MUSIC_MANIFEST[trackId];
        element.volume =
          (config.volume ?? 1) * getEffectiveAudioVolume(settings, "music");
      });
    },
    async play(trackId) {
      const element = ensureTrack(trackId);
      try {
        element.currentTime = 0;
        await element.play();
        return true;
      } catch {
        return false;
      }
    },
    setMuted(nextMuted) {
      muted = nextMuted;
      elements.forEach((element) => {
        element.muted = nextMuted;
      });
    },
    stop(trackId) {
      if (trackId) {
        const element = elements.get(trackId);
        if (!element) {
          return;
        }
        element.pause();
        element.currentTime = 0;
        return;
      }

      elements.forEach((element) => {
        element.pause();
        element.currentTime = 0;
      });
    },
    destroy() {
      elements.forEach((element) => {
        element.pause();
        element.src = "";
      });
      elements.clear();
    },
  };
}
