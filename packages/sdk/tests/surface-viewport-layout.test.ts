import { describe, expect, it } from "vitest";
import {
  SURFACE_VIEWPORT_REFERENCE_SIZES,
  createSurfaceViewportScaleStyle,
  resolveSurfaceViewportAvailableSize,
  resolveSurfaceViewportReferenceSize,
  resolveSurfaceViewportScale,
} from "../src/components/surface-viewport-layout";

describe("surface viewport layout", () => {
  it("uses session-scope reference dimensions in the requested orientation", () => {
    expect(
      resolveSurfaceViewportReferenceSize({
        sessionScope: "controller",
        orientation: "portrait",
        availableWidth: 320,
        availableHeight: 640,
      }),
    ).toEqual(SURFACE_VIEWPORT_REFERENCE_SIZES.controller.portrait);

    expect(
      resolveSurfaceViewportReferenceSize({
        sessionScope: "host",
        orientation: "landscape",
        availableWidth: 640,
        availableHeight: 320,
      }),
    ).toEqual(SURFACE_VIEWPORT_REFERENCE_SIZES.host.landscape);
  });

  it("prefers explicit reference dimensions over scope defaults", () => {
    expect(
      resolveSurfaceViewportReferenceSize({
        sessionScope: "controller",
        designWidth: 500,
        designHeight: 700,
        orientation: "portrait",
        availableWidth: 320,
        availableHeight: 640,
      }),
    ).toEqual({
      width: 500,
      height: 700,
    });
  });

  it("falls back to the available frame size without a session scope", () => {
    expect(
      resolveSurfaceViewportReferenceSize({
        sessionScope: "unscoped",
        orientation: "landscape",
        availableWidth: 1280,
        availableHeight: 720,
      }),
    ).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("swaps available frame size when a rotated orientation is required", () => {
    expect(
      resolveSurfaceViewportAvailableSize({
        safeViewportWidth: 412,
        safeViewportHeight: 915,
        orientation: "landscape",
        needsRotation: true,
      }),
    ).toEqual({
      width: 915,
      height: 412,
    });
  });

  it("computes a proportional ui scale from the reference surface", () => {
    expect(
      resolveSurfaceViewportScale({
        availableWidth: 824,
        availableHeight: 1830,
        referenceWidth: 412,
        referenceHeight: 915,
      }),
    ).toBe(2);
  });

  it("applies the scale multiplier and publishes scoped theme vars", () => {
    const scale = resolveSurfaceViewportScale({
      availableWidth: 824,
      availableHeight: 1830,
      referenceWidth: 412,
      referenceHeight: 915,
      uiScaleMultiplier: 0.9,
    });

    const style = createSurfaceViewportScaleStyle({
      scale,
      referenceWidth: 412,
      referenceHeight: 915,
    });

    expect(scale).toBe(1.8);
    expect(style).toMatchObject({
      width: "100%",
      height: "100%",
      fontSize: "calc(1rem * var(--airjam-ui-scale))",
      "--airjam-ui-scale": "1.8",
      "--airjam-reference-width": "412px",
      "--airjam-reference-height": "915px",
      "--spacing": "calc(0.25rem * var(--airjam-ui-scale))",
      "--text-base": "calc(1rem * var(--airjam-ui-scale))",
      "--radius-lg": "calc(0.625rem * var(--airjam-ui-scale))",
      "--container-md": "calc(28rem * var(--airjam-ui-scale))",
    });
  });
});
