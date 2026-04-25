import type { RuntimeState } from "@air-jam/sdk/protocol";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";
import {
  createRuntimeStateBuffers,
  resetRuntimeStateBufferBall,
  resetRuntimeStateBuffers,
  type RuntimeStateBuffers,
} from "../../game/engine";
import type { PongState } from "../../game/stores";
import { usePongCountdown } from "./use-pong-countdown";

type PongHostPhaseEffect =
  | "start-countdown"
  | "clear-countdown"
  | "reset-match-buffers"
  | "reset-ball";

type PongScoreState = PongState["scores"];

interface UsePongHostRuntimeStateOptions {
  matchPhase: PongState["matchPhase"];
  scores: PongScoreState;
  runtimeState: RuntimeState;
}

interface PongHostRuntimeState {
  runtimeBuffersRef: RefObject<RuntimeStateBuffers>;
  countdownValue: number | null;
  startCountdown: () => void;
}

const haveScoresChanged = ({
  previousScores,
  scores,
}: {
  previousScores: PongScoreState;
  scores: PongScoreState;
}): boolean =>
  previousScores.team1 !== scores.team1 ||
  previousScores.team2 !== scores.team2;

export const getPongHostRuntimeEffects = ({
  previousPhase,
  matchPhase,
  previousScores,
  scores,
}: {
  previousPhase: PongState["matchPhase"];
  matchPhase: PongState["matchPhase"];
  previousScores: PongScoreState;
  scores: PongScoreState;
}): PongHostPhaseEffect[] => {
  const effects: PongHostPhaseEffect[] = [];

  if (
    previousPhase !== matchPhase &&
    previousPhase !== "playing" &&
    matchPhase === "playing"
  ) {
    effects.push("reset-match-buffers", "start-countdown");
  }

  if (
    previousPhase !== matchPhase &&
    previousPhase === "playing" &&
    matchPhase !== "playing"
  ) {
    effects.push("clear-countdown");
  }

  if (
    previousPhase !== matchPhase &&
    previousPhase === "ended" &&
    matchPhase === "lobby"
  ) {
    effects.push("reset-ball");
  }

  if (
    matchPhase === "playing" &&
    haveScoresChanged({
      previousScores,
      scores,
    })
  ) {
    effects.push("start-countdown");
  }

  return effects;
};

export const usePongHostRuntimeState = ({
  matchPhase,
  scores,
  runtimeState,
}: UsePongHostRuntimeStateOptions): PongHostRuntimeState => {
  const runtimeBuffersRef = useRef(createRuntimeStateBuffers());
  const previousMatchPhaseRef = useRef(matchPhase);
  const previousScoresRef = useRef(scores);

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
    const previousScores = previousScoresRef.current;
    const effects = getPongHostRuntimeEffects({
      previousPhase: previousMatchPhase,
      matchPhase,
      previousScores,
      scores,
    });

    previousMatchPhaseRef.current = matchPhase;
    previousScoresRef.current = scores;

    if (effects.length === 0) {
      return;
    }

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
  }, [clearCountdown, matchPhase, scores, startCountdown]);

  return {
    runtimeBuffersRef,
    countdownValue,
    startCountdown,
  };
};
