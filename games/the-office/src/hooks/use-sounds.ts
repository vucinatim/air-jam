/**
 * Sound manager hook for playing game sound effects.
 * Uses HTML5 Audio API for cross-browser compatibility.
 */

import { useRef, useCallback, useEffect } from "react";

/** Available sound effect types */
type SoundType =
  | "task-start"
  | "task-complete"
  | "new-order"
  | "game-over"
  | "order-timeout";

/** Map of sound URLs */
const SOUND_URLS: Record<SoundType, string> = {
  "task-start": "/sounds/task-start.mp3",
  "task-complete": "/sounds/task-complete.mp3",
  "new-order": "/sounds/new-order.mp3",
  "game-over": "/sounds/game-over.mp3",
  "order-timeout": "/sounds/order-timeout.mp3",
};
const SFX_VOLUME = 0.7;

/**
 * Hook for managing game sound effects.
 * Returns functions to play specific sound types.
 */
export function useSounds(muted = false) {
  // Store audio elements to reuse them
  const audioRefs = useRef<Record<SoundType, HTMLAudioElement | null>>({
    "task-start": null,
    "task-complete": null,
    "new-order": null,
    "game-over": null,
    "order-timeout": null,
  });

  useEffect(() => {
    const targetVolume = muted ? 0 : SFX_VOLUME;
    Object.values(audioRefs.current).forEach((audio) => {
      if (!audio) return;
      audio.volume = targetVolume;
    });
  }, [muted]);

  /**
   * Play a sound effect by type.
   * Creates audio element on first play, reuses thereafter.
   */
  const play = useCallback((type: SoundType) => {
    // Get or create audio element
    let audio = audioRefs.current[type];
    if (!audio) {
      audio = new Audio(SOUND_URLS[type]);
      audio.volume = muted ? 0 : SFX_VOLUME;
      audioRefs.current[type] = audio;
    }

    if (muted) {
      return;
    }

    // Reset and play
    // eslint-disable-next-line react-hooks/immutability -- HTMLAudioElement playback state is intentionally mutable runtime state.
    audio.currentTime = 0;
    const playPromise = audio.play();

    // Handle autoplay restrictions gracefully
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay blocked - ignore error
      });
    }
  }, [muted]);

  /**
   * Play task start sound
   */
  const playTaskStart = useCallback(() => {
    play("task-start");
  }, [play]);

  /**
   * Play task complete sound
   */
  const playTaskComplete = useCallback(() => {
    play("task-complete");
  }, [play]);

  /**
   * Play new order spawned sound
   */
  const playNewOrder = useCallback(() => {
    play("new-order");
  }, [play]);

  /**
   * Play game over sound
   */
  const playGameOver = useCallback(() => {
    play("game-over");
  }, [play]);

  /**
   * Play order timeout/expiration sound
   */
  const playOrderTimeout = useCallback(() => {
    play("order-timeout");
  }, [play]);

  return {
    playTaskStart,
    playTaskComplete,
    playNewOrder,
    playGameOver,
    playOrderTimeout,
  };
}
