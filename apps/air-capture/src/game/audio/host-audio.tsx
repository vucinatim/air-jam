import {
  AudioProvider,
  useAudio,
  useAudioManager,
  useProvidedAudio,
  type AudioManager,
  type PlayOptions,
} from "@air-jam/sdk";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  HOST_MUSIC_MANIFEST,
  HOST_MUSIC_TRACKS,
  HOST_SFX_MANIFEST,
  type HostMusicId,
  type HostSfxId,
} from "./sounds";

const MUSIC_CYCLE_DURATION_MS = 180000;

type HostAudioDriver = Pick<
  AudioManager<HostSfxId>,
  "init" | "isMuted" | "mute" | "play" | "stop"
>;

type HostMusicDriver = Pick<AudioManager<HostMusicId>, "load" | "play" | "stop">;

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
  const loadedTracks = new Set<HostMusicId>();

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
    if (!loadedTracks.has(trackId)) {
      audio.load({ [trackId]: HOST_MUSIC_MANIFEST[trackId] });
      loadedTracks.add(trackId);
    }

    stopAll();
    const soundId = audio.play(trackId, { loop: true });

    if (soundId === null) {
      return;
    }

    schedule(() => {
      currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
      playCurrentTrack();
    }, cycleDurationMs);
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

export function HostAudioProvider({
  children,
  muted,
}: {
  children: ReactNode;
  muted: boolean;
}) {
  const sfxAudio = useAudio(HOST_SFX_MANIFEST);
  const musicAudio = useAudioManager<HostMusicId>();
  const facade = useMemo(() => createHostAudioFacade(sfxAudio), [sfxAudio]);
  const musicPlaybackRef = useRef<RotatingMusicPlayback | null>(null);
  const musicUnlockedRef = useRef(false);

  if (!musicPlaybackRef.current) {
    musicPlaybackRef.current = createRotatingMusicPlayback(musicAudio);
  }

  useEffect(() => {
    facade.mute(muted);
    if (musicUnlockedRef.current) {
      musicPlaybackRef.current?.sync(!muted);
    } else {
      musicPlaybackRef.current?.sync(false);
    }
  }, [facade, muted]);

  useEffect(() => {
    if (musicUnlockedRef.current) {
      return;
    }

    const handleInteraction = () => {
      void sfxAudio.init().then((ready) => {
        if (!ready) {
          return;
        }

        musicUnlockedRef.current = true;
        musicPlaybackRef.current?.sync(!muted);
        window.removeEventListener("click", handleInteraction, true);
        window.removeEventListener("touchstart", handleInteraction, true);
        window.removeEventListener("keydown", handleInteraction, true);
        window.removeEventListener("pointerdown", handleInteraction, true);
        window.removeEventListener("mousedown", handleInteraction, true);
      });
    };

    window.addEventListener("click", handleInteraction, true);
    window.addEventListener("touchstart", handleInteraction, true);
    window.addEventListener("keydown", handleInteraction, true);
    window.addEventListener("pointerdown", handleInteraction, true);
    window.addEventListener("mousedown", handleInteraction, true);

    return () => {
      window.removeEventListener("click", handleInteraction, true);
      window.removeEventListener("touchstart", handleInteraction, true);
      window.removeEventListener("keydown", handleInteraction, true);
      window.removeEventListener("pointerdown", handleInteraction, true);
      window.removeEventListener("mousedown", handleInteraction, true);
    };
  }, [muted, sfxAudio]);

  useEffect(() => {
    return () => {
      musicPlaybackRef.current?.dispose();
    };
  }, []);

  return <AudioProvider manager={sfxAudio}>{children}</AudioProvider>;
}

export function useHostAudio(): HostAudioFacade {
  const audio = useProvidedAudio<HostSfxId>();
  return useMemo(() => createHostAudioFacade(audio), [audio]);
}
