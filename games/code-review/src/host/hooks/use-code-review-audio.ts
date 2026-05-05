import { useAudio, useHostAudioMutePreference } from "@air-jam/sdk";
import { useCallback, useEffect, useRef } from "react";
import type {
  CodeReviewSfxId,
  CodeReviewSoundId,
} from "../../game/contracts/sounds";
import type { CodeReviewMatchPhase } from "../../game/stores/code-review-store-types";

export const useCodeReviewAudio = (matchPhase: CodeReviewMatchPhase) => {
  const audioPreference = useHostAudioMutePreference("code-review");
  const audio = useAudio<CodeReviewSoundId>();
  const audioMutedRef = useRef(audioPreference.muted);

  useEffect(() => {
    audioMutedRef.current = audioPreference.muted;
    audio.mute(audioPreference.muted);
  }, [audio, audioPreference.muted]);

  const playSfx = useCallback(
    (key: CodeReviewSfxId) => {
      if (audioMutedRef.current) {
        return;
      }
      audio.play(key);
    },
    [audio],
  );

  const playSfxRef = useRef(playSfx);
  useEffect(() => {
    playSfxRef.current = playSfx;
  }, [playSfx]);

  const playSfxFromRef = useCallback((key: CodeReviewSfxId) => {
    if (audioMutedRef.current) {
      return;
    }
    playSfxRef.current(key);
  }, []);

  const previousMatchPhaseRef = useRef(matchPhase);
  useEffect(() => {
    if (
      previousMatchPhaseRef.current !== "playing" &&
      matchPhase === "playing"
    ) {
      playSfx("bell");
    }
    previousMatchPhaseRef.current = matchPhase;
  }, [matchPhase, playSfx]);

  return {
    audioMuted: audioPreference.muted,
    playSfxFromRef,
    toggleAudioMuted: audioPreference.toggleMuted,
  };
};
