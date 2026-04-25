/**
 * Sound manager hook for playing game sound effects.
 * Uses the Air Jam SDK audio runtime so host mute and arcade volume settings
 * apply consistently across first-party games.
 */

import { useAudio } from "@air-jam/sdk";
import { useCallback, useEffect } from "react";
import type { OfficeSoundId } from "../game/sounds";

/** Available sound effect types */
type SoundType = OfficeSoundId;

/**
 * Hook for managing game sound effects.
 * Returns functions to play specific sound types.
 */
export function useSounds(muted = false) {
  const audio = useAudio<SoundType>();

  useEffect(() => {
    audio.mute(muted);
  }, [audio, muted]);

  /**
   * Play a sound effect by type.
   */
  const play = useCallback(
    (type: SoundType) => {
      if (muted) {
        return;
      }

      audio.play(type);
    },
    [audio, muted],
  );

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
