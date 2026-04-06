import { useEffect, useRef } from "react";
import { useAssertSessionScope } from "../context/session-scope";
import type { GameState } from "../protocol";

export interface UseHostGameStateBridgeOptions<TPhase extends string> {
  phase: TPhase;
  playingPhase: TPhase;
  gameState: GameState;
  toggleGameState: () => void;
  onEnterPlayingPhase?: (context: { previousPhase: TPhase; phase: TPhase }) => void;
  onExitPlayingPhase?: (context: { previousPhase: TPhase; phase: TPhase }) => void;
  onPhaseTransition?: (context: { previousPhase: TPhase; phase: TPhase }) => void;
}

export const useHostGameStateBridge = <TPhase extends string>({
  phase,
  playingPhase,
  gameState,
  toggleGameState,
  onEnterPlayingPhase,
  onExitPlayingPhase,
  onPhaseTransition,
}: UseHostGameStateBridgeOptions<TPhase>): void => {
  useAssertSessionScope("host", "useHostGameStateBridge");

  const previousPhaseRef = useRef<TPhase>(phase);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    const transitioned = previousPhase !== phase;
    if (!transitioned) {
      return;
    }

    const context = { previousPhase, phase };
    onPhaseTransition?.(context);

    if (phase === playingPhase) {
      if (gameState !== "playing") {
        toggleGameState();
      }
      onEnterPlayingPhase?.(context);
      previousPhaseRef.current = phase;
      return;
    }

    if (previousPhase === playingPhase) {
      if (gameState === "playing") {
        toggleGameState();
      }
      onExitPlayingPhase?.(context);
    }

    previousPhaseRef.current = phase;
  }, [
    gameState,
    onEnterPlayingPhase,
    onExitPlayingPhase,
    onPhaseTransition,
    phase,
    playingPhase,
    toggleGameState,
  ]);
};
