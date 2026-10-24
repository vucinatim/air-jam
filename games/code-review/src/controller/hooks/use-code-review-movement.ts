import { useAirJamController } from "@air-jam/sdk";
import { useCallback, useEffect } from "react";
import { useCodeReviewGyro } from "./use-code-review-gyro";

/**
 * Chooses between the touch pad and tilting the phone. Tilt drives the same
 * declared movement axes the pad does.
 */
export const useCodeReviewMovement = ({ enabled }: { enabled: boolean }) => {
  const controls = useAirJamController().input;
  const setDirection = useCallback(
    ({ x, y }: { x: number; y: number }) => {
      controls?.set("horizontal", x);
      controls?.set("vertical", y);
    },
    [controls],
  );
  const {
    motionStatus,
    enableTilt,
    useTouch: selectTouch,
  } = useCodeReviewGyro({ enabled, onDirection: setDirection });
  const useTouch = useCallback(() => {
    selectTouch();
    setDirection({ x: 0, y: 0 });
  }, [selectTouch, setDirection]);
  const movementMode: "touch" | "tilt" =
    motionStatus === "tilt" ? "tilt" : "touch";

  useEffect(() => {
    if (!enabled) setDirection({ x: 0, y: 0 });
  }, [enabled, setDirection]);

  return { movementMode, motionStatus, enableTilt, useTouch };
};
