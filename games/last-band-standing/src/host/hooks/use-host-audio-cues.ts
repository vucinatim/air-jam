import { MATCH_START_COUNTDOWN_SEC } from "@/game/constants";
import { type GamePhase } from "@/game/domain/types";
import { type RoundReveal } from "@/game/stores/types";
import { useAudio } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseHostAudioCuesInput {
  phase: GamePhase;
  roundReveal: RoundReveal | null;
  matchCountdownSeconds: number;
  countdownSeconds: number;
}

export const useHostAudioCues = ({
  phase,
  roundReveal,
  matchCountdownSeconds,
  countdownSeconds,
}: UseHostAudioCuesInput) => {
  const audio = useAudio();
  const [muted, setMuted] = useState(false);
  const previousPhaseRef = useRef<string>(phase);
  const previousMatchCountdownRef = useRef<number | null>(null);
  const previousCountdownRef = useRef<number | null>(null);

  useEffect(() => {
    audio.mute(muted);
  }, [audio, muted]);

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
      matchCountdownSeconds > 0 &&
      matchCountdownSeconds <= MATCH_START_COUNTDOWN_SEC &&
      previousMatchCountdownRef.current !== matchCountdownSeconds
    ) {
      audio.play("countdown-tick");
    }

    previousMatchCountdownRef.current = matchCountdownSeconds;
  }, [audio, phase, matchCountdownSeconds]);

  useEffect(() => {
    if (phase !== "round-active") {
      previousCountdownRef.current = null;
      return;
    }

    if (
      previousCountdownRef.current !== null &&
      countdownSeconds < previousCountdownRef.current &&
      countdownSeconds > 0 &&
      countdownSeconds <= 5
    ) {
      audio.play("countdown-tick");
    }

    previousCountdownRef.current = countdownSeconds;
  }, [audio, phase, countdownSeconds]);

  const toggleMuted = useCallback(() => {
    setMuted((previous) => !previous);
  }, []);

  return { muted, toggleMuted };
};
