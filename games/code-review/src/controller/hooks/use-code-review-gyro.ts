import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

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
  verticalRef: MutableRefObject<number>;
  horizontalRef: MutableRefObject<number>;
}

export const useCodeReviewGyro = ({
  verticalRef,
  horizontalRef,
}: UseCodeReviewGyroOptions) => {
  const gyroActiveRef = useRef(false);
  const deviceOrientationEvent = resolveDeviceOrientationEvent();
  const hasGyroscopeSupport = deviceOrientationEvent !== null;
  const needsPermission =
    typeof deviceOrientationEvent?.requestPermission === "function";

  const handleOrientation = useRef((event: DeviceOrientationEvent) => {
    if (event.gamma !== null) {
      verticalRef.current = smoothDirection(
        verticalRef.current,
        tiltToDirection(event.gamma, true),
      );
    }

    if (event.beta !== null) {
      horizontalRef.current = smoothDirection(
        horizontalRef.current,
        tiltToDirection(event.beta, false),
      );
    }
  });

  useEffect(() => {
    if (!hasGyroscopeSupport || needsPermission) return;

    const orientationHandler = handleOrientation.current;
    window.addEventListener("deviceorientation", orientationHandler);
    gyroActiveRef.current = true;

    return () => {
      window.removeEventListener("deviceorientation", orientationHandler);
      gyroActiveRef.current = false;
    };
  }, [hasGyroscopeSupport, needsPermission]);

  useEffect(() => {
    const orientationHandler = handleOrientation.current;

    return () => {
      window.removeEventListener("deviceorientation", orientationHandler);
      gyroActiveRef.current = false;
    };
  }, []);

  const requestPermissions = useCallback(async () => {
    if (gyroActiveRef.current || !deviceOrientationEvent) return;

    if (deviceOrientationEvent.requestPermission) {
      const permission = await deviceOrientationEvent.requestPermission();
      if (permission !== "granted") return;
    }

    window.addEventListener("deviceorientation", handleOrientation.current);
    gyroActiveRef.current = true;
  }, [deviceOrientationEvent]);

  return {
    hasGyroscopeSupport,
    needsPermission,
    requestPermissions,
  };
};
