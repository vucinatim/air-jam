import { describe, expect, it } from "vitest";
import {
  AIRJAM_SAFE_AREA_BOTTOM,
  AIRJAM_SAFE_AREA_LEFT,
  AIRJAM_SAFE_AREA_TOP,
  AIRJAM_SAFE_VIEWPORT_HEIGHT,
  AIRJAM_SAFE_VIEWPORT_WIDTH,
  createSurfaceViewportOuterStyle,
  resolveForcedOrientationFrameStyle,
} from "../src/components/surface-orientation-layout";

describe("surface orientation layout", () => {
  it("publishes safe-area and safe-viewport css variables", () => {
    expect(createSurfaceViewportOuterStyle()).toMatchObject({
      "--airjam-safe-area-top": AIRJAM_SAFE_AREA_TOP,
      "--airjam-safe-area-bottom": AIRJAM_SAFE_AREA_BOTTOM,
      "--airjam-safe-area-left": AIRJAM_SAFE_AREA_LEFT,
      "--airjam-safe-viewport-width": AIRJAM_SAFE_VIEWPORT_WIDTH,
      "--airjam-safe-viewport-height": AIRJAM_SAFE_VIEWPORT_HEIGHT,
    });
  });

  it("uses the safe viewport as the unrotated content frame", () => {
    expect(resolveForcedOrientationFrameStyle("portrait", false)).toMatchObject(
      {
        position: "absolute",
        top: AIRJAM_SAFE_AREA_TOP,
        left: AIRJAM_SAFE_AREA_LEFT,
        width: AIRJAM_SAFE_VIEWPORT_WIDTH,
        height: AIRJAM_SAFE_VIEWPORT_HEIGHT,
        overflow: "hidden",
      },
    );
  });

  it("rotates into a safe landscape frame when needed", () => {
    expect(resolveForcedOrientationFrameStyle("landscape", true)).toMatchObject(
      {
        width: AIRJAM_SAFE_VIEWPORT_HEIGHT,
        height: AIRJAM_SAFE_VIEWPORT_WIDTH,
        transformOrigin: "top left",
        transform: `translateX(${AIRJAM_SAFE_VIEWPORT_WIDTH}) rotate(90deg)`,
      },
    );
  });
});
