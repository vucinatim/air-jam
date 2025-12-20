import { useAudio } from "@air-jam/sdk";
import { useEffect, useRef, useState } from "react";
import { SOUND_MANIFEST } from "../sounds";

const MUSIC_TRACKS: Array<keyof typeof SOUND_MANIFEST> = [
  "bgm_track_1",
  "bgm_track_2",
  "bgm_track_3",
  "bgm_track_4",
];

/**
 * Hook to manage background music that cycles through multiple tracks
 * Each track loops individually, and after a set duration, moves to the next track
 */
export function useBackgroundMusic(enabled: boolean = true) {
  const audio = useAudio(SOUND_MANIFEST);
  const currentTrackIndexRef = useRef(0);
  const currentSoundIdRef = useRef<number | null>(null);
  const trackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  const [audioReady, setAudioReady] = useState(false);

  // Wait for audio context to be ready (after user interaction)
  // The useAudio hook already handles initialization on user interaction,
  // so we just need to check when it's ready
  useEffect(() => {
    // If not ready, poll periodically
    // The useAudio hook will call init() on user interaction, so we check periodically
    const checkInterval = setInterval(() => {
      if (audio.isReady()) {
        setAudioReady(true);
        clearInterval(checkInterval);
      }
    }, 100);

    // Initial check - use requestAnimationFrame to avoid synchronous setState
    requestAnimationFrame(() => {
      if (audio.isReady()) {
        setAudioReady(true);
        clearInterval(checkInterval);
      }
    });

    return () => {
      clearInterval(checkInterval);
    };
  }, [audio]);

  useEffect(() => {
    if (!enabled || !audioReady) {
      // Stop all music if disabled or audio not ready
      MUSIC_TRACKS.forEach((track) => {
        audio.stop(track);
      });
      if (trackTimerRef.current) {
        clearTimeout(trackTimerRef.current);
        trackTimerRef.current = null;
      }
      currentSoundIdRef.current = null;
      isPlayingRef.current = false;
      return;
    }

    // Prevent multiple instances from starting
    if (isPlayingRef.current) {
      return;
    }

    const playNextTrack = () => {
      // Clear any existing timer first to prevent race conditions
      if (trackTimerRef.current) {
        clearTimeout(trackTimerRef.current);
        trackTimerRef.current = null;
      }

      // Stop ALL music tracks first to ensure no overlap
      // This is important because looping tracks might have multiple instances
      // Calling stop() without a soundId stops all instances of that track
      MUSIC_TRACKS.forEach((track) => {
        audio.stop(track); // Stop all instances of each track
      });
      currentSoundIdRef.current = null;

      // Get current track
      const trackId = MUSIC_TRACKS[currentTrackIndexRef.current];

      // Play the track with looping
      const soundId = audio.play(trackId, {
        loop: true,
      });
      if (soundId !== null) {
        currentSoundIdRef.current = soundId;
        isPlayingRef.current = true;

        // We'll cycle tracks after 3 minutes (180 seconds) to allow each track to play
        // You can adjust this or make it dynamic based on track duration
        const CYCLE_DURATION_MS = 180000; // 3 minutes per track

        // Set timer to cycle to next track
        trackTimerRef.current = setTimeout(() => {
          // Move to next track
          currentTrackIndexRef.current =
            (currentTrackIndexRef.current + 1) % MUSIC_TRACKS.length;
          playNextTrack();
        }, CYCLE_DURATION_MS);
      }
    };

    // Start playing music
    playNextTrack();

    // Cleanup on unmount or when disabled
    return () => {
      // Stop all tracks
      MUSIC_TRACKS.forEach((track) => {
        audio.stop(track);
      });
      if (trackTimerRef.current) {
        clearTimeout(trackTimerRef.current);
        trackTimerRef.current = null;
      }
      currentSoundIdRef.current = null;
      isPlayingRef.current = false;
    };
  }, [enabled, audioReady, audio]);
}
