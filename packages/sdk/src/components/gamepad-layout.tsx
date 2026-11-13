import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface GamepadLayoutProps extends Omit<
  ComponentProps<"div">,
  "children"
> {
  /** The control under the left thumb, usually the `Stick`. */
  left: ReactNode;
  /** The control under the right thumb, usually the main `ControlButton`. */
  right: ReactNode;
  /** Short status between the thumbs: a word, a number or a few icons. */
  center?: ReactNode;
}

// Sizes follow the layout's height, the phone's short side, and shrink only
// when a narrow screen would leave the centre column too little room.
const layoutStyle = {
  containerType: "size",
  "--airjam-thumb-size": "min(62cqh, 27cqw)",
  "--airjam-thumb-margin": "min(10cqh, 5cqw)",
} as CSSProperties;

const zoneStyle: CSSProperties = {
  width: "calc(var(--airjam-thumb-size) + 2 * var(--airjam-thumb-margin))",
};

const slotStyle: CSSProperties = {
  width: "var(--airjam-thumb-size)",
  height: "var(--airjam-thumb-size)",
};

const ThumbZone = ({ children }: { children: ReactNode }) => (
  <div
    className="flex h-full flex-none items-center justify-center"
    style={zoneStyle}
  >
    <div className="grid *:size-full" style={slotStyle}>
      {children}
    </div>
  </div>
);

/**
 * A sideways controller laid out like a gamepad: two equal thumb controls
 * mirrored about the centre on one line, each centred in its thumb zone, with
 * a compact centre column between them. It fills its parent; put a header
 * above it.
 */
export const GamepadLayout = ({
  left,
  right,
  center,
  className,
  style,
  ...props
}: GamepadLayoutProps) => (
  <div
    {...props}
    className={cn("flex h-full w-full items-center", className)}
    style={{ ...layoutStyle, ...style }}
  >
    <ThumbZone>{left}</ThumbZone>
    <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-2 text-center">
      {center}
    </div>
    <ThumbZone>{right}</ThumbZone>
  </div>
);
