import type { CSSProperties, JSX, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../utils/cn";
import {
  createSurfaceViewportOuterStyle,
  resolveForcedOrientationFrameStyle,
  type SurfaceOrientation,
} from "./surface-orientation-layout";
import {
  createSurfaceViewportScaleStyle,
  resolveSurfaceViewportAvailableSize,
  resolveSurfaceViewportReferenceSize,
  resolveSurfaceViewportScale,
  type SurfaceViewportPreset,
} from "./surface-viewport-layout";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: SurfaceOrientation) => Promise<void>;
};

interface ViewportSize {
  width: number;
  height: number;
}

const readViewportSize = (): ViewportSize => {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
};

const getOrientation = ({
  width,
  height,
}: ViewportSize): SurfaceOrientation => {
  if (width > 0 && height > 0) {
    return width >= height ? "landscape" : "portrait";
  }

  if (typeof window !== "undefined") {
    if (window.matchMedia) {
      if (window.matchMedia("(orientation: portrait)").matches) {
        return "portrait";
      }
      if (window.matchMedia("(orientation: landscape)").matches) {
        return "landscape";
      }
    }

    if (window.screen?.orientation?.type) {
      if (window.screen.orientation.type.startsWith("portrait")) {
        return "portrait";
      }
      if (window.screen.orientation.type.startsWith("landscape")) {
        return "landscape";
      }
    }
  }

  return width >= height ? "landscape" : "portrait";
};

export interface SurfaceViewportProps {
  children: ReactNode;
  orientation?: SurfaceOrientation;
  lockOnGesture?: boolean;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  preset?: SurfaceViewportPreset;
  designWidth?: number;
  designHeight?: number;
  uiScaleMultiplier?: number;
  minScale?: number;
  maxScale?: number;
}

export const SurfaceViewport = ({
  children,
  orientation,
  lockOnGesture = true,
  className,
  contentClassName,
  style,
  preset,
  designWidth,
  designHeight,
  uiScaleMultiplier,
  minScale,
  maxScale,
}: SurfaceViewportProps): JSX.Element => {
  const [viewport, setViewport] = useState<ViewportSize | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewport = () => setViewport(readViewportSize());

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !orientation || !lockOnGesture) {
      return;
    }

    const tryLock = () => {
      if (!("orientation" in screen)) {
        return;
      }

      const screenOrientation = screen.orientation as ScreenOrientationWithLock;
      if (!screenOrientation?.lock) {
        return;
      }

      void screenOrientation.lock(orientation).catch(() => {
        // Best-effort only. Some browsers reject lock outside fullscreen.
      });
    };

    const onFirstGesture = () => {
      tryLock();
      window.removeEventListener("pointerdown", onFirstGesture, true);
    };

    window.addEventListener("pointerdown", onFirstGesture, true);

    return () => {
      window.removeEventListener("pointerdown", onFirstGesture, true);
    };
  }, [orientation, lockOnGesture]);

  const currentOrientation = viewport ? getOrientation(viewport) : "portrait";
  const effectiveOrientation = orientation ?? currentOrientation;
  const needsRotation = orientation
    ? currentOrientation !== orientation
    : false;

  const shellStyle = useMemo<CSSProperties>(
    () =>
      orientation
        ? resolveForcedOrientationFrameStyle(orientation, needsRotation)
        : resolveForcedOrientationFrameStyle(effectiveOrientation, false),
    [effectiveOrientation, needsRotation, orientation],
  );

  const availableSize = useMemo(
    () =>
      resolveSurfaceViewportAvailableSize({
        safeViewportWidth: viewport?.width ?? 0,
        safeViewportHeight: viewport?.height ?? 0,
        orientation,
        needsRotation,
      }),
    [needsRotation, orientation, viewport],
  );

  const referenceSize = useMemo(
    () =>
      resolveSurfaceViewportReferenceSize({
        preset,
        designWidth,
        designHeight,
        orientation: effectiveOrientation,
        availableWidth: availableSize.width,
        availableHeight: availableSize.height,
      }),
    [
      availableSize.height,
      availableSize.width,
      designHeight,
      designWidth,
      effectiveOrientation,
      preset,
    ],
  );

  const scale = useMemo(
    () =>
      resolveSurfaceViewportScale({
        availableWidth: availableSize.width,
        availableHeight: availableSize.height,
        referenceWidth: referenceSize.width,
        referenceHeight: referenceSize.height,
        uiScaleMultiplier,
        minScale,
        maxScale,
      }),
    [
      availableSize.height,
      availableSize.width,
      maxScale,
      minScale,
      referenceSize.height,
      referenceSize.width,
      uiScaleMultiplier,
    ],
  );

  return (
    <div
      className={cn("fixed inset-0 overflow-hidden", className)}
      style={{
        ...createSurfaceViewportOuterStyle(),
        ...style,
      }}
    >
      <div style={shellStyle}>
        <div
          className={cn("h-full w-full overflow-hidden", contentClassName)}
          data-airjam-surface-viewport="true"
          style={createSurfaceViewportScaleStyle({
            scale,
            referenceWidth: referenceSize.width,
            referenceHeight: referenceSize.height,
          })}
        >
          <div
            className="h-full w-full"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export type { SurfaceOrientation };
