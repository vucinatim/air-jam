import { useAudio, useSendSignal } from "@air-jam/sdk";
import { useCallback, useEffect, useRef } from "react";
import {
  createMatchWinnerToastSignal,
  createPaddleHitHapticSignal,
} from "../../game/contracts/controller-signals";
import type { PongSoundId } from "../../game/contracts/sounds";
import type { TeamId } from "../../game/domain/team";
import { usePongStore } from "../../game/stores";

const HIT_FEEDBACK_COOLDOWN_MS = 70;

export const usePongFeedback = () => {
  const audio = useAudio<PongSoundId>();
  const sendSignal = useSendSignal();
  const matchPhase = usePongStore((state) => state.matchPhase);
  const matchSummary = usePongStore((state) => state.matchSummary);
  const matchSummaryWinner = matchSummary?.winner ?? null;
  const lastHitAtRef = useRef(0);
  const previousPhaseRef = useRef(matchPhase);
  const announcedEndRef = useRef<string | null>(null);

  const triggerPaddleHitFeedback = useCallback(
    (event: { team: TeamId; playerId: string | null }) => {
      const now = Date.now();
      if (now - lastHitAtRef.current < HIT_FEEDBACK_COOLDOWN_MS) {
        return;
      }
      lastHitAtRef.current = now;

      if (!event.playerId) {
        // Bot paddle hits are host-local only.
        audio.play("hit", {
          pitch: event.team === "team1" ? 1.05 : 0.95,
        });
        return;
      }

      // Hit feedback is controller-only for the player who hit the ball.
      audio.play("hit", {
        remote: true,
        target: event.playerId,
        volume: 0.45,
      });
      sendSignal("HAPTIC", createPaddleHitHapticSignal(), event.playerId);
    },
    [audio, sendSignal],
  );

  const triggerScoreFeedback = useCallback(() => {
    // Score cue is host-only.
    audio.play("score");
  }, [audio]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;

    if (previousPhase !== "playing" && matchPhase === "playing") {
      // Start cue is host-only.
      audio.play("start");
      announcedEndRef.current = null;
    }

    if (matchPhase === "ended" && matchSummaryWinner) {
      if (announcedEndRef.current !== matchSummaryWinner) {
        announcedEndRef.current = matchSummaryWinner;
        // Win cue is host-only.
        audio.play("win");
        sendSignal(
          "TOAST",
          createMatchWinnerToastSignal(matchSummaryWinner, matchSummary),
        );
      }
    }

    previousPhaseRef.current = matchPhase;
  }, [audio, matchPhase, matchSummary, matchSummaryWinner, sendSignal]);

  return {
    triggerPaddleHitFeedback,
    triggerScoreFeedback,
  };
};
