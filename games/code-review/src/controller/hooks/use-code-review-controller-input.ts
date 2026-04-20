import { useControllerTick, useInputWriter } from "@air-jam/sdk";
import { useCallback, useEffect, useRef } from "react";
import { PUNCH_COOLDOWN_MS } from "../../game/domain/combat-rules";
import { useCodeReviewGyro } from "./use-code-review-gyro";

interface UseCodeReviewControllerInputOptions {
  enabled: boolean;
}

export const useCodeReviewControllerInput = ({
  enabled,
}: UseCodeReviewControllerInputOptions) => {
  const writeInput = useInputWriter();
  const verticalRef = useRef(0);
  const horizontalRef = useRef(0);
  const defendRef = useRef(false);
  const punchRef = useRef({ left: false, right: false });
  const cooldownRef = useRef({ left: false, right: false });
  const cooldownTimeoutRef = useRef<{
    left: number | null;
    right: number | null;
  }>({ left: null, right: null });

  const gyro = useCodeReviewGyro({ verticalRef, horizontalRef });

  useControllerTick(
    () => {
      const leftPunch = punchRef.current.left;
      const rightPunch = punchRef.current.right;

      writeInput({
        vertical: verticalRef.current,
        horizontal: horizontalRef.current,
        leftPunch,
        rightPunch,
        defend: defendRef.current,
      });

      if (leftPunch) {
        punchRef.current.left = false;
      }
      if (rightPunch) {
        punchRef.current.right = false;
      }
    },
    {
      enabled,
      intervalMs: 16,
    },
  );

  useEffect(() => {
    verticalRef.current = 0;
    horizontalRef.current = 0;
  }, []);

  const triggerPunch = useCallback((side: "left" | "right") => {
    if (cooldownRef.current[side]) return;

    punchRef.current[side] = true;
    cooldownRef.current[side] = true;

    if (cooldownTimeoutRef.current[side] !== null) {
      window.clearTimeout(cooldownTimeoutRef.current[side]);
    }

    cooldownTimeoutRef.current[side] = window.setTimeout(() => {
      cooldownRef.current[side] = false;
      cooldownTimeoutRef.current[side] = null;
    }, PUNCH_COOLDOWN_MS);
  }, []);

  useEffect(() => {
    const cooldownTimeouts = cooldownTimeoutRef.current;

    return () => {
      for (const side of ["left", "right"] as const) {
        if (cooldownTimeouts[side] !== null) {
          window.clearTimeout(cooldownTimeouts[side]);
        }
      }
    };
  }, []);

  useEffect(() => {
    const releaseControls = () => {
      verticalRef.current = 0;
      horizontalRef.current = 0;
      defendRef.current = false;
      punchRef.current.left = false;
      punchRef.current.right = false;
    };

    window.addEventListener("blur", releaseControls);
    document.addEventListener("visibilitychange", releaseControls);

    return () => {
      window.removeEventListener("blur", releaseControls);
      document.removeEventListener("visibilitychange", releaseControls);
    };
  }, []);

  const triggerLeftPunch = useCallback(
    () => triggerPunch("left"),
    [triggerPunch],
  );
  const triggerRightPunch = useCallback(
    () => triggerPunch("right"),
    [triggerPunch],
  );
  const startDefending = useCallback(() => {
    defendRef.current = true;
  }, []);
  const stopDefending = useCallback(() => {
    defendRef.current = false;
  }, []);

  return {
    hasGyroscopeSupport: gyro.hasGyroscopeSupport,
    needsGyroscopePermission: gyro.needsPermission,
    requestPermissions: gyro.requestPermissions,
    triggerLeftPunch,
    triggerRightPunch,
    startDefending,
    stopDefending,
  };
};
