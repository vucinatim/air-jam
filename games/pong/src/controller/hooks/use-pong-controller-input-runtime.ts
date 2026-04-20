import {
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { useCallback, useEffect, useRef } from "react";

const PONG_CONTROLLER_INPUT_TICK_MS = 16;

export type PongControllerDirection = -1 | 0 | 1;

interface UsePongControllerInputRuntimeOptions {
  controlsDisabled: boolean;
}

export const usePongControllerInputRuntime = ({
  controlsDisabled,
}: UsePongControllerInputRuntimeOptions) => {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const directionRef = useRef<PongControllerDirection>(0);

  useControllerTick(
    () => {
      writeInput({
        direction: directionRef.current,
      });
    },
    {
      enabled:
        controller.connectionStatus === "connected" &&
        controller.runtimeState === "playing",
      intervalMs: PONG_CONTROLLER_INPUT_TICK_MS,
    },
  );

  const setDirection = useCallback((direction: PongControllerDirection) => {
    directionRef.current = direction;
  }, []);

  const releaseDirection = useCallback(() => {
    directionRef.current = 0;
  }, []);

  useEffect(() => {
    if (controlsDisabled) {
      releaseDirection();
    }
  }, [controlsDisabled, releaseDirection]);

  useEffect(() => {
    window.addEventListener("blur", releaseDirection);
    document.addEventListener("visibilitychange", releaseDirection);

    return () => {
      window.removeEventListener("blur", releaseDirection);
      document.removeEventListener("visibilitychange", releaseDirection);
    };
  }, [releaseDirection]);

  return {
    setDirection,
  };
};
