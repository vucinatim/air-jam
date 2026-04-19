import type { RuntimeState } from "@air-jam/sdk/protocol";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import {
  createRuntimeStateBuffers,
  resetRuntimeStateBufferBall,
  resetRuntimeStateBuffers,
  type RuntimeStateBuffers,
} from "../game/engine";
import type { PongState } from "../game/stores";
import { getPongHostPhaseEffects } from "./pong-host-state-machine";
import { usePongCountdown } from "./use-pong-countdown";

interface UsePongHostRuntimeStateOptions {
  matchPhase: PongState["matchPhase"];
  runtimeState: RuntimeState;
}

interface PongHostRuntimeState {
  runtimeBuffersRef: RefObject<RuntimeStateBuffers>;
  countdownValue: number | null;
  startCountdown: () => void;
}

export const usePongHostRuntimeState = ({
  matchPhase,
  runtimeState,
}: UsePongHostRuntimeStateOptions): PongHostRuntimeState => {
  const runtimeBuffersRef = useRef(createRuntimeStateBuffers());
  const previousMatchPhaseRef = useRef(matchPhase);

  const launchBall = useCallback(() => {
    resetRuntimeStateBufferBall(runtimeBuffersRef.current);
  }, []);

  const countdown = usePongCountdown({
    matchPhase,
    runtimeState,
    onLaunch: launchBall,
  });

  const {
    value: countdownValue,
    start: startCountdown,
    clear: clearCountdown,
  } = countdown;

  useEffect(() => {
    const previousMatchPhase = previousMatchPhaseRef.current;
    if (previousMatchPhase === matchPhase) {
      return;
    }

    const effects = getPongHostPhaseEffects({
      previousPhase: previousMatchPhase,
      matchPhase,
    });

    if (effects.includes("reset-match-buffers")) {
      resetRuntimeStateBuffers(runtimeBuffersRef.current);
    }
    if (effects.includes("start-countdown")) {
      startCountdown();
    }
    if (effects.includes("clear-countdown")) {
      clearCountdown();
    }
    if (effects.includes("reset-ball")) {
      resetRuntimeStateBufferBall(runtimeBuffersRef.current);
    }

    previousMatchPhaseRef.current = matchPhase;
  }, [clearCountdown, matchPhase, startCountdown]);

  return {
    runtimeBuffersRef,
    countdownValue,
    startCountdown,
  };
};
