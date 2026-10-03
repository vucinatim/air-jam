import { useCallback, useEffect, useRef, useState } from "react";

const GYRO_MAX_TILT = 25;
const GYRO_DEAD_ZONE = 12;
const GYRO_SMOOTHING = 0.08;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const lerp = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

type DeviceOrientationEventWithPermission = {
  prototype: DeviceOrientationEvent;
  requestPermission?: () => Promise<"granted" | "denied">;
};

const resolveDeviceOrientationEvent =
  (): DeviceOrientationEventWithPermission | null => {
    const candidate = (
      globalThis as {
        DeviceOrientationEvent?: DeviceOrientationEventWithPermission;
      }
    ).DeviceOrientationEvent;

    return candidate ?? null;
  };

const tiltToDirection = (tilt: number, invert: boolean) => {
  if (Math.abs(tilt) < GYRO_DEAD_ZONE) return 0;
  const sign = tilt > 0 ? 1 : -1;
  const magnitude =
    (Math.abs(tilt) - GYRO_DEAD_ZONE) / (GYRO_MAX_TILT - GYRO_DEAD_ZONE);
  return clamp((invert ? -sign : sign) * magnitude, -1, 1);
};

const smoothDirection = (current: number, target: number) => {
  if (Math.abs(target) < 0.05 && Math.abs(current) < 0.05) return 0;

  const changing =
    Math.sign(current) !== Math.sign(target) && Math.abs(target) > 0.1;
  const factor = changing ? 0.25 : GYRO_SMOOTHING;
  return lerp(current, target, factor);
};

interface UseCodeReviewGyroOptions {
  enabled: boolean;
  onDirection: (direction: { x: number; y: number }) => void;
}

type MotionStatus = "touch" | "requesting" | "tilt" | "denied" | "unavailable";

export const useCodeReviewGyro = ({
  enabled,
  onDirection,
}: UseCodeReviewGyroOptions) => {
  const [motionStatus, setMotionStatus] = useState<MotionStatus>("touch");
  const requestRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!enabled || motionStatus !== "tilt") return;
    // Smoothing belongs to this sensor subscription, never to a previous gesture.
    const request = requestRef.current;
    let x = 0;
    let y = 0;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (
        request !== requestRef.current ||
        document.hidden ||
        !document.hasFocus()
      )
        return;
      if (
        event.beta === null ||
        event.gamma === null ||
        !Number.isFinite(event.beta) ||
        !Number.isFinite(event.gamma)
      )
        return;
      x = smoothDirection(x, tiltToDirection(event.beta, false));
      y = smoothDirection(y, tiltToDirection(event.gamma, true));
      onDirection({ x, y });
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation);
  }, [enabled, motionStatus, onDirection]);

  const useTouch = useCallback(() => {
    requestRef.current += 1;
    setMotionStatus("touch");
  }, []);

  const enableTilt = useCallback(async () => {
    const request = ++requestRef.current;
    const deviceOrientationEvent = resolveDeviceOrientationEvent();
    if (!deviceOrientationEvent) {
      setMotionStatus("unavailable");
      return;
    }
    setMotionStatus("requesting");
    let status: MotionStatus;
    try {
      // Call before the first await: iOS requires the original user gesture.
      const permission = deviceOrientationEvent.requestPermission
        ? await deviceOrientationEvent.requestPermission()
        : "granted";
      status = permission === "granted" ? "tilt" : "denied";
    } catch {
      status = "denied";
    }
    if (mountedRef.current && request === requestRef.current) {
      onDirection({ x: 0, y: 0 });
      setMotionStatus(status);
    }
  }, [onDirection]);

  return {
    motionStatus,
    enableTilt,
    useTouch,
  };
};
