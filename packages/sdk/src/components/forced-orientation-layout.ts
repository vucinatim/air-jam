import type { CSSProperties } from "react";
import type { ForcedOrientation } from "./forced-orientation-shell";

export const AIRJAM_SAFE_AREA_TOP = "env(safe-area-inset-top, 0px)";
export const AIRJAM_SAFE_AREA_RIGHT = "env(safe-area-inset-right, 0px)";
export const AIRJAM_SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";
export const AIRJAM_SAFE_AREA_LEFT = "env(safe-area-inset-left, 0px)";
export const AIRJAM_SAFE_VIEWPORT_WIDTH = `calc(100dvw - ${AIRJAM_SAFE_AREA_LEFT} - ${AIRJAM_SAFE_AREA_RIGHT})`;
export const AIRJAM_SAFE_VIEWPORT_HEIGHT = `calc(100dvh - ${AIRJAM_SAFE_AREA_TOP} - ${AIRJAM_SAFE_AREA_BOTTOM})`;

export const createForcedOrientationShellOuterStyle = (): CSSProperties => ({
  ["--airjam-safe-area-top" as const]: AIRJAM_SAFE_AREA_TOP,
  ["--airjam-safe-area-right" as const]: AIRJAM_SAFE_AREA_RIGHT,
  ["--airjam-safe-area-bottom" as const]: AIRJAM_SAFE_AREA_BOTTOM,
  ["--airjam-safe-area-left" as const]: AIRJAM_SAFE_AREA_LEFT,
  ["--airjam-safe-viewport-width" as const]: AIRJAM_SAFE_VIEWPORT_WIDTH,
  ["--airjam-safe-viewport-height" as const]: AIRJAM_SAFE_VIEWPORT_HEIGHT,
} as CSSProperties);

export const resolveForcedOrientationFrameStyle = (
  desired: ForcedOrientation,
  needsRotation: boolean,
): CSSProperties => {
  if (!needsRotation) {
    return {
      position: "absolute",
      top: AIRJAM_SAFE_AREA_TOP,
      left: AIRJAM_SAFE_AREA_LEFT,
      width: AIRJAM_SAFE_VIEWPORT_WIDTH,
      height: AIRJAM_SAFE_VIEWPORT_HEIGHT,
      overflow: "hidden",
    };
  }

  if (desired === "landscape") {
    return {
      position: "absolute",
      top: AIRJAM_SAFE_AREA_TOP,
      left: AIRJAM_SAFE_AREA_LEFT,
      width: AIRJAM_SAFE_VIEWPORT_HEIGHT,
      height: AIRJAM_SAFE_VIEWPORT_WIDTH,
      overflow: "hidden",
      transformOrigin: "top left",
      transform: `translateX(${AIRJAM_SAFE_VIEWPORT_WIDTH}) rotate(90deg)`,
    };
  }

  return {
    position: "absolute",
    top: AIRJAM_SAFE_AREA_TOP,
    left: AIRJAM_SAFE_AREA_LEFT,
    width: AIRJAM_SAFE_VIEWPORT_HEIGHT,
    height: AIRJAM_SAFE_VIEWPORT_WIDTH,
    overflow: "hidden",
    transformOrigin: "top left",
    transform: `translateY(${AIRJAM_SAFE_VIEWPORT_HEIGHT}) rotate(-90deg)`,
  };
};
