import { useControllerTick, useInputWriter } from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { PUNCH_COOLDOWN_MS } from "../../game/domain/combat-rules";
import { useCodeReviewGyro } from "./use-code-review-gyro";

interface UseCodeReviewControllerInputOptions {
  enabled: boolean;
}

const neutralInput = () => ({
  vertical: 0,
  horizontal: 0,
  leftPunch: false,
  rightPunch: false,
  defend: false,
});

const isForeground = () => !document.hidden && document.hasFocus();

export const useCodeReviewControllerInput = ({
  enabled,
}: UseCodeReviewControllerInputOptions) => {
  const writeInput = useInputWriter();
  const inputRef = useRef(neutralInput());
  const cooldownUntilRef = useRef({ left: 0, right: 0 });
  const [foreground, setForeground] = useState(isForeground);
  const active = enabled && foreground;

  const releaseControls = useCallback(() => {
    inputRef.current = neutralInput();
    // The SDK writer checks session/connection readiness. Neutralize now, not
    // on the next tick: hidden pages may stop ticking altogether.
    writeInput({ ...inputRef.current });
  }, [writeInput]);

  useEffect(() => {
    const updateForeground = () => {
      const next = isForeground();
      if (!next && enabled) releaseControls();
      setForeground(next);
    };
    const onBlur = () => {
      if (enabled) releaseControls();
      setForeground(false);
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", updateForeground);
    document.addEventListener("visibilitychange", updateForeground);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", updateForeground);
      document.removeEventListener("visibilitychange", updateForeground);
    };
  }, [enabled, releaseControls]);

  useEffect(() => {
    if (!active) return;
    return releaseControls;
  }, [active, releaseControls]);

  const setDirection = useCallback((direction: { x: number; y: number }) => {
    inputRef.current.horizontal = direction.x;
    inputRef.current.vertical = direction.y;
  }, []);
  const {
    motionStatus,
    enableTilt: requestTilt,
    useTouch: selectTouch,
  } = useCodeReviewGyro({
    enabled: active,
    onDirection: setDirection,
  });
  const movementMode: "touch" | "tilt" =
    motionStatus === "tilt" ? "tilt" : "touch";

  useControllerTick(
    () => {
      if (!active || !isForeground()) return;
      writeInput({ ...inputRef.current });
      inputRef.current.leftPunch = false;
      inputRef.current.rightPunch = false;
    },
    { enabled: active, intervalMs: 16 },
  );

  const move = useCallback(
    (direction: { x: number; y: number }) => {
      if (!enabled || !isForeground() || movementMode !== "touch") return;
      if (!Number.isFinite(direction.x) || !Number.isFinite(direction.y))
        return;
      setDirection({
        x: Math.max(-1, Math.min(1, direction.x)),
        y: Math.max(-1, Math.min(1, direction.y)),
      });
    },
    [enabled, movementMode, setDirection],
  );

  const triggerPunch = useCallback(
    (side: "left" | "right") => {
      if (!enabled || !isForeground()) return;
      const now = performance.now();
      if (now < cooldownUntilRef.current[side]) return;
      cooldownUntilRef.current[side] = now + PUNCH_COOLDOWN_MS;
      inputRef.current[side === "left" ? "leftPunch" : "rightPunch"] = true;
    },
    [enabled],
  );

  const triggerLeftPunch = useCallback(
    () => triggerPunch("left"),
    [triggerPunch],
  );
  const triggerRightPunch = useCallback(
    () => triggerPunch("right"),
    [triggerPunch],
  );
  const startDefending = useCallback(() => {
    if (enabled && isForeground()) inputRef.current.defend = true;
  }, [enabled]);
  const stopDefending = useCallback(() => {
    inputRef.current.defend = false;
  }, []);
  const enableTilt = useCallback(async () => {
    if (active) releaseControls();
    await requestTilt();
  }, [active, requestTilt, releaseControls]);
  const useTouch = useCallback(() => {
    if (active) releaseControls();
    selectTouch();
  }, [active, selectTouch, releaseControls]);

  return {
    movementMode,
    motionStatus,
    enableTilt,
    useTouch,
    move,
    triggerLeftPunch,
    triggerRightPunch,
    startDefending,
    stopDefending,
  };
};
