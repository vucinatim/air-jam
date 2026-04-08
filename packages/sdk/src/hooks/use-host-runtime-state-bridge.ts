import { useEffect, useRef } from "react";
import { useAssertSessionScope } from "../context/session-scope";
import { isActiveMatchPhase, type StandardMatchPhase } from "../lifecycle";
import type { RuntimeState } from "../protocol";

export interface UseHostRuntimeStateBridgeOptions {
  matchPhase: StandardMatchPhase;
  runtimeState: RuntimeState;
  toggleRuntimeState: () => void;
  onEnterActivePhase?: (context: {
    previousPhase: StandardMatchPhase;
    matchPhase: StandardMatchPhase;
  }) => void;
  onExitActivePhase?: (context: {
    previousPhase: StandardMatchPhase;
    matchPhase: StandardMatchPhase;
  }) => void;
  onPhaseTransition?: (context: {
    previousPhase: StandardMatchPhase;
    matchPhase: StandardMatchPhase;
  }) => void;
}

export const useHostRuntimeStateBridge = ({
  matchPhase,
  runtimeState,
  toggleRuntimeState,
  onEnterActivePhase,
  onExitActivePhase,
  onPhaseTransition,
}: UseHostRuntimeStateBridgeOptions): void => {
  useAssertSessionScope("host", "useHostRuntimeStateBridge");

  const previousPhaseRef = useRef<StandardMatchPhase>(matchPhase);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (previousPhase === matchPhase) {
      return;
    }

    const context = { previousPhase, matchPhase };
    onPhaseTransition?.(context);

    const nextIsActive = isActiveMatchPhase(matchPhase);
    const previousWasActive = isActiveMatchPhase(previousPhase);

    if (nextIsActive) {
      if (runtimeState !== "playing") {
        toggleRuntimeState();
      }
      if (!previousWasActive) {
        onEnterActivePhase?.(context);
      }
      previousPhaseRef.current = matchPhase;
      return;
    }

    if (previousWasActive) {
      if (runtimeState === "playing") {
        toggleRuntimeState();
      }
      onExitActivePhase?.(context);
    }

    previousPhaseRef.current = matchPhase;
  }, [
    matchPhase,
    onEnterActivePhase,
    onExitActivePhase,
    onPhaseTransition,
    runtimeState,
    toggleRuntimeState,
  ]);
};
