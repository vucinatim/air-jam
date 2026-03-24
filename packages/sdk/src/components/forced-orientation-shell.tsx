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
  if (typeof window !== "undefined") {
    if (window.screen?.orientation?.type) {
      if (window.screen.orientation.type.startsWith("portrait")) {
        return "portrait";
      }
      if (window.screen.orientation.type.startsWith("landscape")) {
        return "landscape";
      }
    }

    if (window.matchMedia) {
      if (window.matchMedia("(orientation: portrait)").matches) {
        return "portrait";
      }
      if (window.matchMedia("(orientation: landscape)").matches) {
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

  const shellStyle = useMemo<CSSProperties>(() => {
    if (!needsRotation) {
      return {
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        overflow: "hidden",
      };
    }

    if (!viewport) {
      return {
        position: "fixed",
        inset: 0,
        width: "100dvw",
        height: "100dvh",
        overflow: "hidden",
      };
    }

    const { width, height } = viewport;

    if (desired === "landscape") {
      return {
        position: "fixed",
        inset: 0,
        width: `${height}px`,
        height: `${width}px`,
        overflow: "hidden",
        transformOrigin: "top left",
        transform: `translateX(${width}px) rotate(90deg)`,
      };
    }

    return {
      position: "fixed",
      inset: 0,
      width: `${height}px`,
      height: `${width}px`,
      overflow: "hidden",
      transformOrigin: "top left",
      transform: `translateY(${height}px) rotate(-90deg)`,
    };
  }, [desired, needsRotation, viewport]);

  return (
    <div
      className={cn("fixed inset-0 overflow-hidden", className)}
      style={{
        ...shellStyle,
        ...style,
      }}
    >
      <div className={cn("h-full w-full", contentClassName)}>{children}</div>
    </div>
  );
};
