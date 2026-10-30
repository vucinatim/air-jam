import { quizSettings } from "@/game/contracts/settings";
import { type GamePhase } from "@/game/domain/types";
import { type RoundReveal } from "@/game/stores/types";
import {
  useAirJamSettings,
  useAudio,
  useHostAudioMutePreference,
} from "@air-jam/sdk";
import { useEffect, useRef } from "react";

interface UseHostAudioCuesInput {
  phase: GamePhase;
  roundReveal: RoundReveal | null;
  secondsLeft: number;
}

export const useHostAudioCues = ({
  phase,
  roundReveal,
  secondsLeft,
}: UseHostAudioCuesInput) => {
  const { matchStartCountdownSec } = useAirJamSettings(quizSettings);
  const audio = useAudio();
  const audioPreference = useHostAudioMutePreference("last-band-standing");
  const previousPhaseRef = useRef<string>(phase);
  const previousMatchCountdownRef = useRef<number | null>(null);
  const previousCountdownRef = useRef<number | null>(null);

  useEffect(() => {
    audio.mute(audioPreference.muted);
  }, [audio, audioPreference.muted]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;
    if (previousPhase === phase) return;

    if (phase === "round-active") {
      audio.play("round-start");
    }

    if (phase === "round-reveal" && roundReveal) {
      const anyCorrect = Object.values(roundReveal.resultsByPlayerId).some(
        (result) => result.isCorrect,
      );
      audio.play(anyCorrect ? "correct" : "wrong");
    }

    if (phase === "game-over") {
      audio.play("victory");
    }
  }, [audio, phase, roundReveal]);

  useEffect(() => {
    if (phase !== "match-countdown") {
      previousMatchCountdownRef.current = null;
      return;
    }

    if (
      secondsLeft > 0 &&
      secondsLeft <= matchStartCountdownSec &&
      previousMatchCountdownRef.current !== secondsLeft
    ) {
      audio.play("countdown-tick");
    }

    previousMatchCountdownRef.current = secondsLeft;
  }, [audio, phase, secondsLeft]);

  useEffect(() => {
    if (phase !== "round-active") {
      previousCountdownRef.current = null;
      return;
    }

    if (
      previousCountdownRef.current !== null &&
      secondsLeft < previousCountdownRef.current &&
      secondsLeft > 0 &&
      secondsLeft <= 5
    ) {
      audio.play("countdown-tick");
    }

    previousCountdownRef.current = secondsLeft;
  }, [audio, phase, secondsLeft]);

  return {
    muted: audioPreference.muted,
    toggleMuted: audioPreference.toggleMuted,
  };
};
