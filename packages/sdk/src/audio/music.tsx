import { useEffect, useMemo, useRef } from "react";
import { getEffectiveAudioVolume } from "../settings/platform-settings";
import {
  usePlatformSettingsRuntimeStatus,
  useResolvedPlatformSettingsSnapshot,
} from "../settings/platform-settings-runtime";
import { type SoundCategory } from "./audio-manager";
import { useAudio, useAudioRuntimeStatus } from "./hooks";

export type AudioVolumeCategory = SoundCategory | "master";

export interface MusicPlaylistProps<TTrackId extends string = string> {
  tracks: readonly TTrackId[];
  playing: boolean;
  order?: "sequence" | "shuffle";
  fadeMs?: number;
  startIndex?: number;
}

export function useAudioCategoryVolume(category: AudioVolumeCategory): number {
  const settingsStatus = usePlatformSettingsRuntimeStatus();
  const settings = useResolvedPlatformSettingsSnapshot();

  if (settingsStatus !== "ready") {
    return 0;
  }

  if (category === "master") {
    return settings.audio.masterVolume;
  }

  return getEffectiveAudioVolume(settings.audio, category);
}

export function useMusicVolume(): number {
  return useAudioCategoryVolume("music");
}

export function MusicPlaylist<TTrackId extends string = string>({
  tracks,
  playing,
  order = "sequence",
  fadeMs = 1000,
  startIndex = 0,
}: MusicPlaylistProps<TTrackId>) {
  const audio = useAudio<TTrackId>();
  const status = useAudioRuntimeStatus();
  const activeRef = useRef<{ trackId: TTrackId; soundId: number } | null>(null);
  const generationRef = useRef(0);
  const tracksRef = useRef(tracks);
  const tracksKey = useMemo(() => tracks.join("\0"), [tracks]);
  tracksRef.current = tracks;

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let disposed = false;

    const stopActive = () => {
      const active = activeRef.current;
      if (!active) {
        return;
      }

      activeRef.current = null;
      audio.fadeOutAndStop(active.trackId, active.soundId, fadeMs);
    };

    const getNextIndex = (currentIndex: number): number => {
      const currentTracks = tracksRef.current;
      if (currentTracks.length <= 1) {
        return 0;
      }

      if (order === "shuffle") {
        const randomOffset = Math.floor(
          Math.random() * (currentTracks.length - 1),
        );
        return (currentIndex + 1 + randomOffset) % currentTracks.length;
      }

      return (currentIndex + 1) % currentTracks.length;
    };

    const startTrack = (trackIndex: number) => {
      const currentTracks = tracksRef.current;
      if (
        disposed ||
        generationRef.current !== generation ||
        !playing ||
        status !== "ready" ||
        currentTracks.length === 0
      ) {
        return;
      }

      const normalizedIndex =
        ((trackIndex % currentTracks.length) + currentTracks.length) %
        currentTracks.length;
      const trackId = currentTracks[normalizedIndex];
      const soundId = audio.play(trackId, {
        fadeInMs: fadeMs,
        loop: false,
        onEnd: (endedSoundId) => {
          const active = activeRef.current;
          if (
            disposed ||
            generationRef.current !== generation ||
            !active ||
            active.trackId !== trackId ||
            active.soundId !== endedSoundId
          ) {
            return;
          }

          activeRef.current = null;
          startTrack(getNextIndex(normalizedIndex));
        },
      });

      if (soundId !== null) {
        activeRef.current = { trackId, soundId };
      }
    };

    stopActive();

    if (playing && status === "ready" && tracksRef.current.length > 0) {
      startTrack(startIndex);
    }

    return () => {
      disposed = true;
      stopActive();
    };
  }, [audio, fadeMs, order, playing, startIndex, status, tracksKey]);

  return null;
}
