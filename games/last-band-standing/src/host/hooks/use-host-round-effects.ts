import { FINALIZE_POLL_MS } from "@/game/constants";
import { type GamePhase } from "@/game/domain/types";
import { type ActiveRound, type RoundReveal } from "@/game/stores";
import { useEffect } from "react";

interface HostRoundEffectActions {
  completeMatchCountdown: (payload: { nowMs?: number }) => void;
  advanceFromReveal: (payload: { nowMs?: number }) => void;
  finalizeRound: (payload: { nowMs?: number }) => void;
}

interface UseHostRoundEffectsInput {
  actions: HostRoundEffectActions;
  phase: GamePhase;
  currentRound: ActiveRound | null;
  roundReveal: RoundReveal | null;
}

export const useHostRoundEffects = ({
  actions,
  phase,
  currentRound,
  roundReveal,
}: UseHostRoundEffectsInput) => {
  useEffect(() => {
    if (phase !== "match-countdown" || !currentRound) return;

    const delayMs = Math.max(0, currentRound.startedAtMs - Date.now()) + 25;
    const timeoutId = window.setTimeout(() => {
      actions.completeMatchCountdown({ nowMs: Date.now() });
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [actions, phase, currentRound]);

  useEffect(() => {
    if (phase !== "round-active") return;

    const intervalId = window.setInterval(() => {
      actions.finalizeRound({ nowMs: Date.now() });
    }, FINALIZE_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [actions, phase]);

  useEffect(() => {
    if (phase !== "round-reveal" || !roundReveal) return;

    const delayMs = Math.max(0, roundReveal.revealEndsAtMs - Date.now()) + 25;
    const timeoutId = window.setTimeout(() => {
      actions.advanceFromReveal({ nowMs: Date.now() });
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [actions, phase, roundReveal]);
};
