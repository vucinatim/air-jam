"use client";

import { triggerLocalHaptic } from "@/lib/local-haptics";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CornerDownLeft,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface RemoteDPadProps {
  onMove: (vector: { x: number; y: number }) => void;
  onConfirm: () => void;
  onConfirmRelease: () => void;
  hapticsEnabled: boolean;
}

const remoteDPadSizeStyle: CSSProperties = {
  width:
    "clamp(13rem, min(20rem, calc(var(--airjam-reference-width, 100dvw) * 0.82), calc(var(--airjam-reference-height, 100dvh) * 0.42)), 20rem)",
  maxWidth: "100%",
};

/**
 * A circular remote-style D-Pad with center confirm button
 * Styled to match the dark, segmented ring design with constant-width gaps
 * Uses refs for fast, responsive input handling without React re-renders
 */
export const RemoteDPad = ({
  onMove,
  onConfirm,
  onConfirmRelease,
  hapticsEnabled,
}: RemoteDPadProps) => {
  // Use refs to track state without causing re-renders
  const moveDirRef = useRef<"up" | "down" | "left" | "right" | "none">("none");
  const confirmPressedRef = useRef(false);

  // Only use state for visual feedback (UI updates)
  const [moveDir, setMoveDir] = useState<
    "up" | "down" | "left" | "right" | "none"
  >("none");
  const [isConfirmPressed, setConfirmPressed] = useState(false);

  const handleMove = useCallback(
    (direction: "up" | "down" | "left" | "right" | "none") => {
      const previousDirection = moveDirRef.current;

      // Update ref immediately (no re-render)
      moveDirRef.current = direction;

      // Update visual state (causes re-render for UI feedback)
      setMoveDir(direction);

      if (direction !== "none" && previousDirection !== direction) {
        if (hapticsEnabled) triggerLocalHaptic("selection");
      }

      // Call callback immediately with new value
      switch (direction) {
        case "up":
          onMove({ x: 0, y: -1 });
          break;
        case "down":
          onMove({ x: 0, y: 1 });
          break;
        case "left":
          onMove({ x: -1, y: 0 });
          break;
        case "right":
          onMove({ x: 1, y: 0 });
          break;
        case "none":
          onMove({ x: 0, y: 0 });
          break;
      }
    },
    [hapticsEnabled, onMove],
  );

  const handleMoveEnd = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      // Only stop if the button being released is the active one
      if (moveDirRef.current === direction) {
        handleMove("none");
      }
    },
    [handleMove],
  );

  const handleConfirm = useCallback(
    (pressed: boolean) => {
      confirmPressedRef.current = pressed;
      setConfirmPressed(pressed);

      if (pressed) {
        if (hapticsEnabled) triggerLocalHaptic("confirm");
        onConfirm();
      } else {
        onConfirmRelease();
      }
    },
    [hapticsEnabled, onConfirm, onConfirmRelease],
  );

  // SVG Geometry Config
  const size = 320;
  const center = size / 2;
  const outerRadius = 158;
  const innerRadius = 64; // Increased inner radius for larger center button
  const gapWidth = 12; // Constant physical gap in pixels

  // Calculate intersection of circle and line y = x - k
  // Used to define the segment edges parallel to the diagonals
  const getIntersection = useCallback((r: number, k: number) => {
    // x = (k + sqrt(2r^2 - k^2)) / 2
    const term = Math.sqrt(2 * r * r - k * k);
    const x = (k + term) / 2;
    const y = x - k;
    return { x, y };
  }, []);

  // Create path for the Right segment (centered at 0 degrees)
  const createSegmentPath = useCallback(() => {
    const k = (gapWidth / 2) * Math.sqrt(2);

    // Outer and inner intersection points
    const pOuter = getIntersection(outerRadius, k);
    const pInner = getIntersection(innerRadius, k);

    const x1_in = center + pInner.x;
    const y1_in = center - pInner.y; // Upper half
    const x2_out = center + pOuter.x;
    const y2_out = center - pOuter.y;
    const x3_out = center + pOuter.x;
    const y3_out = center + pOuter.y; // Lower half
    const x4_in = center + pInner.x;
    const y4_in = center + pInner.y;

    return `
      M ${x1_in} ${y1_in}
      L ${x2_out} ${y2_out}
      A ${outerRadius} ${outerRadius} 0 0 1 ${x3_out} ${y3_out}
      L ${x4_in} ${y4_in}
      A ${innerRadius} ${innerRadius} 0 0 0 ${x1_in} ${y1_in}
      Z
    `;
  }, [center, gapWidth, getIntersection, innerRadius, outerRadius]);

  const segmentPath = createSegmentPath();

  // Create callback refs that attach native touch listeners with { passive: false }
  const createPathRef = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      let cleanup: (() => void) | null = null;

      return (el: SVGPathElement | null) => {
        // Clean up previous listeners if element changed
        if (cleanup) {
          cleanup();
          cleanup = null;
        }

        if (!el) return;

        const touchStart = (e: TouchEvent) => {
          e.preventDefault();
          handleMove(dir);
        };
        const touchEnd = (e: TouchEvent) => {
          e.preventDefault();
          handleMoveEnd(dir);
        };

        el.addEventListener("touchstart", touchStart, { passive: false });
        el.addEventListener("touchend", touchEnd, { passive: false });

        cleanup = () => {
          el.removeEventListener("touchstart", touchStart);
          el.removeEventListener("touchend", touchEnd);
        };
      };
    },
    [handleMove, handleMoveEnd],
  );

  const pathRefs = useMemo(
    () => ({
      up: createPathRef("up"),
      down: createPathRef("down"),
      left: createPathRef("left"),
      right: createPathRef("right"),
    }),
    [createPathRef],
  );

  // Reusable props for the segment buttons
  const getSegmentProps = useCallback(
    (dir: "up" | "down" | "left" | "right", rotation: number) => {
      const isActive = moveDir === dir;
      return {
        ref: pathRefs[dir],
        d: segmentPath,
        transform: `rotate(${rotation}, ${center}, ${center})`,
        className: `
          transition-all duration-100 ease-out cursor-pointer outline-none tap-highlight-transparent
          ${isActive ? "fill-neutral-700" : "fill-neutral-800"}
          hover:fill-neutral-750
        `,
        style: {
          filter: isActive
            ? "drop-shadow(0 0 0 transparent)" // Remove shadow to look "pressed in"
            : "drop-shadow(0 4px 6px rgba(0,0,0,0.3))", // Raised look
          transform: `rotate(${rotation}deg) ${isActive ? "scale(0.98)" : "scale(1)"}`,
          transformOrigin: `${center}px ${center}px`,
        },
        onMouseDown: () => handleMove(dir),
        onMouseUp: () => handleMoveEnd(dir),
        onMouseLeave: () => handleMoveEnd(dir),
      };
    },
    [center, handleMove, handleMoveEnd, moveDir, pathRefs, segmentPath],
  );

  const centerBtnRadius = innerRadius - gapWidth; // Consistent gap

  // Ref for center button to attach native touch listeners
  const centerButtonRef = useRef<HTMLButtonElement | null>(null);

  // Attach native touch event listeners to center button with { passive: false }
  useEffect(() => {
    const button = centerButtonRef.current;
    if (!button) return;

    const touchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleConfirm(true);
    };
    const touchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleConfirm(false);
    };

    button.addEventListener("touchstart", touchStart, { passive: false });
    button.addEventListener("touchend", touchEnd, { passive: false });

    return () => {
      button.removeEventListener("touchstart", touchStart);
      button.removeEventListener("touchend", touchEnd);
    };
  }, [handleConfirm]);

  // Calculate icon positions
  const iconRadius = (innerRadius + outerRadius) / 2;
  const getIconStyle = useCallback(
    (angleDeg: number) => {
      const angleRad = angleDeg * (Math.PI / 180);
      const x = center + iconRadius * Math.cos(angleRad);
      const y = center + iconRadius * Math.sin(angleRad);
      return {
        position: "absolute" as const,
        left: `${(x / size) * 100}%`,
        top: `${(y / size) * 100}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none" as const,
        opacity: 0.6,
      };
    },
    [center, iconRadius],
  );

  return (
    <div
      className="relative aspect-square shrink select-none"
      style={remoteDPadSizeStyle}
    >
      {/* SVG Ring Segments */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-hidden"
      >
        <path {...getSegmentProps("right", 0)} />
        <path {...getSegmentProps("down", 90)} />
        <path {...getSegmentProps("left", 180)} />
        <path {...getSegmentProps("up", 270)} />
      </svg>

      {/* Center Confirm Button */}
      <button
        ref={centerButtonRef}
        className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-neutral-900 transition-all duration-100 ease-out ${isConfirmPressed ? "scale-95 bg-neutral-700 shadow-inner" : "bg-neutral-800 shadow-xl"} `}
        style={{
          width: `${((centerBtnRadius * 2) / size) * 100}%`,
          height: `${((centerBtnRadius * 2) / size) * 100}%`,
          borderWidth:
            "clamp(2px, calc(var(--airjam-reference-width, 100dvw) * 0.011), 4px)",
        }}
        onMouseDown={() => handleConfirm(true)}
        onMouseUp={() => handleConfirm(false)}
        onMouseLeave={() => handleConfirm(false)}
      >
        <CornerDownLeft
          className={`h-6 w-6 text-neutral-400 transition-opacity ${isConfirmPressed ? "opacity-100" : "opacity-70"}`}
        />
      </button>

      {/* Direction Icons Overlay */}
      <div className="pointer-events-none absolute inset-0">
        <div style={getIconStyle(-90)}>
          <ChevronUp className="h-6 w-6 text-neutral-400" />
        </div>
        <div style={getIconStyle(90)}>
          <ChevronDown className="h-6 w-6 text-neutral-400" />
        </div>
        <div style={getIconStyle(180)}>
          <ChevronLeft className="h-6 w-6 text-neutral-400" />
        </div>
        <div style={getIconStyle(0)}>
          <ChevronRight className="h-6 w-6 text-neutral-400" />
        </div>
      </div>
    </div>
  );
};
