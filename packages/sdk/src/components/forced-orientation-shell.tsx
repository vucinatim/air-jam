import type {
  CSSProperties,
  JSX,
  ReactNode,
} from "react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "../utils/cn";
import {
  createForcedOrientationShellOuterStyle,
  resolveForcedOrientationFrameStyle,
} from "./forced-orientation-layout";

export type ForcedOrientation = "portrait" | "landscape";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: ForcedOrientation) => Promise<void>;
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

const getOrientation = ({ width, height }: ViewportSize): ForcedOrientation => {
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

export interface ForcedOrientationShellProps {
  desired: ForcedOrientation;
  children: ReactNode;
  lockOnGesture?: boolean;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
}

export const ForcedOrientationShell = ({
  desired,
  children,
  lockOnGesture = true,
  className,
  contentClassName,
  style,
}: ForcedOrientationShellProps): JSX.Element => {
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
    if (typeof window === "undefined" || !lockOnGesture) {
      return;
    }

    const tryLock = () => {
      if (!("orientation" in screen)) {
        return;
      }

      const orientation = screen.orientation as ScreenOrientationWithLock;
      if (!orientation?.lock) {
        return;
      }

      void orientation.lock(desired).catch(() => {
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
  }, [desired, lockOnGesture]);

  const currentOrientation = viewport ? getOrientation(viewport) : desired;
  const needsRotation = viewport ? currentOrientation !== desired : false;

  const shellStyle = useMemo<CSSProperties>(
    () => resolveForcedOrientationFrameStyle(desired, needsRotation),
    [desired, needsRotation],
  );

  return (
    <div
      className={cn("fixed inset-0 overflow-hidden", className)}
      style={{
        ...createForcedOrientationShellOuterStyle(),
        ...style,
      }}
    >
      <div style={shellStyle}>
        <div className={cn("h-full w-full", contentClassName)}>{children}</div>
      </div>
    </div>
  );
};
