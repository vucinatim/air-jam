import type { CSSProperties } from "react";
import type { SurfaceOrientation } from "./surface-orientation-layout";

export type SurfaceViewportPreset = "controller-phone" | "host-standard";

interface SurfaceViewportPresetDimensions {
  portrait: {
    width: number;
    height: number;
  };
  landscape: {
    width: number;
    height: number;
  };
}

export const SURFACE_VIEWPORT_PRESETS: Record<
  SurfaceViewportPreset,
  SurfaceViewportPresetDimensions
> = {
  "controller-phone": {
    portrait: {
      width: 412,
      height: 915,
    },
    landscape: {
      width: 915,
      height: 412,
    },
  },
  "host-standard": {
    portrait: {
      width: 900,
      height: 1600,
    },
    landscape: {
      width: 1600,
      height: 900,
    },
  },
};

const SURFACE_VIEWPORT_TEXT_SIZE_BASES = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
  "6xl": "3.75rem",
  "7xl": "4.5rem",
  "8xl": "6rem",
  "9xl": "8rem",
} as const;

const SURFACE_VIEWPORT_CONTAINER_BASES = {
  "3xs": "16rem",
  "2xs": "18rem",
  xs: "20rem",
  sm: "24rem",
  md: "28rem",
  lg: "32rem",
  xl: "36rem",
  "2xl": "42rem",
  "3xl": "48rem",
  "4xl": "56rem",
  "5xl": "64rem",
  "6xl": "72rem",
  "7xl": "80rem",
} as const;

const SURFACE_VIEWPORT_RADIUS_BASES = {
  xs: "0.125rem",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.625rem",
  xl: "0.875rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  "4xl": "2rem",
} as const;

interface ResolveSurfaceViewportReferenceSizeOptions {
  preset?: SurfaceViewportPreset;
  designWidth?: number;
  designHeight?: number;
  orientation: SurfaceOrientation;
  availableWidth: number;
  availableHeight: number;
}

export const resolveSurfaceViewportReferenceSize = ({
  preset,
  designWidth,
  designHeight,
  orientation,
  availableWidth,
  availableHeight,
}: ResolveSurfaceViewportReferenceSizeOptions): {
  width: number;
  height: number;
} => {
  if (
    typeof designWidth === "number" &&
    Number.isFinite(designWidth) &&
    designWidth > 0 &&
    typeof designHeight === "number" &&
    Number.isFinite(designHeight) &&
    designHeight > 0
  ) {
    return {
      width: designWidth,
      height: designHeight,
    };
  }

  if (preset) {
    return SURFACE_VIEWPORT_PRESETS[preset][orientation];
  }

  return {
    width: Math.max(availableWidth, 1),
    height: Math.max(availableHeight, 1),
  };
};

export interface ResolveSurfaceViewportAvailableSizeOptions {
  safeViewportWidth: number;
  safeViewportHeight: number;
  orientation?: SurfaceOrientation;
  needsRotation: boolean;
}

export const resolveSurfaceViewportAvailableSize = ({
  safeViewportWidth,
  safeViewportHeight,
  orientation,
  needsRotation,
}: ResolveSurfaceViewportAvailableSizeOptions): {
  width: number;
  height: number;
} => {
  if (!orientation || !needsRotation) {
    return {
      width: safeViewportWidth,
      height: safeViewportHeight,
    };
  }

  return {
    width: safeViewportHeight,
    height: safeViewportWidth,
  };
};

export interface ResolveSurfaceViewportScaleOptions {
  availableWidth: number;
  availableHeight: number;
  referenceWidth: number;
  referenceHeight: number;
  uiScaleMultiplier?: number;
  minScale?: number;
  maxScale?: number;
}

export const resolveSurfaceViewportScale = ({
  availableWidth,
  availableHeight,
  referenceWidth,
  referenceHeight,
  uiScaleMultiplier = 1,
  minScale,
  maxScale,
}: ResolveSurfaceViewportScaleOptions): number => {
  const safeAvailableWidth = Math.max(availableWidth, 1);
  const safeAvailableHeight = Math.max(availableHeight, 1);
  const safeReferenceWidth = Math.max(referenceWidth, 1);
  const safeReferenceHeight = Math.max(referenceHeight, 1);

  let scale =
    Math.min(
      safeAvailableWidth / safeReferenceWidth,
      safeAvailableHeight / safeReferenceHeight,
    ) * uiScaleMultiplier;

  if (typeof minScale === "number" && Number.isFinite(minScale)) {
    scale = Math.max(scale, minScale);
  }

  if (typeof maxScale === "number" && Number.isFinite(maxScale)) {
    scale = Math.min(scale, maxScale);
  }

  return scale;
};

const createScaledVariableValue = (baseValue: string): string =>
  `calc(${baseValue} * var(--airjam-ui-scale))`;

export const createSurfaceViewportScaleStyle = ({
  scale,
  referenceWidth,
  referenceHeight,
}: {
  scale: number;
  referenceWidth: number;
  referenceHeight: number;
}): CSSProperties => {
  const style: Record<string, string> = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    fontSize: createScaledVariableValue("1rem"),
    "--airjam-ui-scale": String(scale),
    "--airjam-ui-rem": createScaledVariableValue("1rem"),
    "--airjam-reference-width": `${referenceWidth}px`,
    "--airjam-reference-height": `${referenceHeight}px`,
    "--spacing": createScaledVariableValue("0.25rem"),
    "--radius": createScaledVariableValue("0.625rem"),
  };

  for (const [name, baseValue] of Object.entries(
    SURFACE_VIEWPORT_TEXT_SIZE_BASES,
  )) {
    style[`--text-${name}`] = createScaledVariableValue(baseValue);
  }

  for (const [name, baseValue] of Object.entries(
    SURFACE_VIEWPORT_CONTAINER_BASES,
  )) {
    style[`--container-${name}`] = createScaledVariableValue(baseValue);
  }

  for (const [name, baseValue] of Object.entries(
    SURFACE_VIEWPORT_RADIUS_BASES,
  )) {
    style[`--radius-${name}`] = createScaledVariableValue(baseValue);
  }

  return style as CSSProperties;
};
