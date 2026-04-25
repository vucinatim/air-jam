import type { RuntimeState } from "@air-jam/sdk/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PongState } from "../../game/stores";

const PONG_COUNTDOWN_SECONDS = 3;

type PongCountdownState =
  | { phase: "idle" }
  | { phase: "counting"; value: number };

interface UsePongCountdownOptions {
  matchPhase: PongState["matchPhase"];
  runtimeState: RuntimeState;
  onLaunch: () => void;
}

export interface PongCountdownApi {
  value: number | null;
  start: () => void;
  clear: () => void;
}

export const usePongCountdown = ({
  matchPhase,
  runtimeState,
  onLaunch,
}: UsePongCountdownOptions): PongCountdownApi => {
  const [state, setState] = useState<PongCountdownState>({ phase: "idle" });

  const start = useCallback(() => {
    setState({ phase: "counting", value: PONG_COUNTDOWN_SECONDS });
  }, []);

  const clear = useCallback(() => {
    setState({ phase: "idle" });
  }, []);

  useEffect(() => {
    if (state.phase !== "counting") {
      return;
    }

    if (runtimeState !== "playing" || matchPhase !== "playing") {
      return;
    }

    const timer = setTimeout(() => {
      if (state.value <= 1) {
        onLaunch();
        setState({ phase: "idle" });
        return;
      }

      setState({ phase: "counting", value: state.value - 1 });
    }, 1000);

    return () => clearTimeout(timer);
  }, [matchPhase, onLaunch, runtimeState, state]);

  return useMemo(
    () => ({
      value: state.phase === "counting" ? state.value : null,
      start,
      clear,
    }),
    [clear, start, state],
  );
};
