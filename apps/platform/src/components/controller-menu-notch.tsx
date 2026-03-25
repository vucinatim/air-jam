"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Phone-style waterdrop notch: flat top, concave sides curving inward
 * to a fat rounded bottom.
 *
 * We start the path at y=0 and use `-translate-y-[3px]` on the button
 * to completely hide the top stroke under the screen bezel.
 */
const NOTCH_W = 96;
const NOTCH_H = 42;

const NOTCH_PATH = [
  "M 0 0 H 96",
  // right concave side
  "C 84 0, 74 12, 68 22",
  // rounded bottom right -> center
  "C 62 34, 56 38, 48 38",
  // rounded bottom left
  "C 40 38, 34 34, 28 22",
  // left concave side
  "C 22 12, 12 0, 0 0",
  "Z",
].join(" ");

type ControllerMenuNotchProps = {
  className?: string;
  strokeClassName: string;
  pulse?: boolean;
  onClick: () => void;
  position: "fixed" | "absolute";
  placement?: "top" | "right";
  "aria-label": string;
  title?: string;
  children: ReactNode;
};

export const ControllerMenuNotch = ({
  className,
  strokeClassName,
  pulse,
  onClick,
  position,
  placement = "top",
  "aria-label": ariaLabel,
  title,
  children,
}: ControllerMenuNotchProps) => {
  const isRightPlacement = placement === "right";

  return (
    <button
      type="button"
      className={cn(
        position === "fixed"
          ? isRightPlacement
            ? "fixed top-1/2 right-0 z-40"
            : "fixed top-0 left-1/2 z-40"
          : isRightPlacement
            ? "absolute top-1/2 right-0 z-10"
            : "absolute top-0 left-1/2 z-10",
        isRightPlacement
          ? "translate-x-px -translate-y-1/2"
          : "-translate-x-1/2 -translate-y-px",
        "cursor-pointer touch-manipulation",
        pulse && "animate-pulse",
        className,
      )}
      style={{
        width: isRightPlacement ? NOTCH_H : NOTCH_W,
        height: isRightPlacement ? NOTCH_W : NOTCH_H,
      }}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
    >
      <svg
        className={cn(
          "pointer-events-none absolute drop-shadow-sm",
          isRightPlacement
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
            : "inset-0 size-full",
        )}
        viewBox={`0 0 ${NOTCH_W} ${NOTCH_H}`}
        fill="none"
        aria-hidden
        style={
          isRightPlacement ? { width: NOTCH_W, height: NOTCH_H } : undefined
        }
      >
        <path
          d={NOTCH_PATH}
          className={cn(
            "fill-background transition-colors duration-300",
            strokeClassName,
          )}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={cn(
          "relative z-10 flex items-center justify-center",
          isRightPlacement
            ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90"
            : "size-full pt-2 pb-4",
        )}
        style={
          isRightPlacement ? { width: NOTCH_W, height: NOTCH_H } : undefined
        }
      >
        {children}
      </span>
    </button>
  );
};
