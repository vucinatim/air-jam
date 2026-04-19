import {
  Loader2,
  Minus,
  MonitorSmartphone,
  SlidersHorizontal,
  TabletSmartphone,
  TriangleAlert,
  X,
} from "lucide-react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useState } from "react";
import { shellPanelClassName } from "../components/shell-classes";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { cn } from "../utils/cn";
import {
  PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
  PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE,
  PREVIEW_WINDOW_TITLEBAR_HEIGHT,
  type PreviewControllerResizeHandle,
} from "./layout";
import type { PreviewControllerSession } from "./manager";

const PREVIEW_WINDOW_SETTINGS_SHELF_HEIGHT = 52;

export const previewControllerWindowStateLabel: Record<
  PreviewControllerSession["surfaceState"],
  string
> = {
  loading: "Loading",
  ready: "Ready",
  failed: "Blocked",
};

export interface PreviewControllerWindowProps {
  session: PreviewControllerSession;
  activeOpacity: number;
  highContrast?: boolean;
  dragging?: boolean;
  onFocus: () => void;
  onMinimize: () => void;
  onRemove: () => void;
  onRotate: () => void;
  onActiveOpacityChange?: (opacity: number) => void;
  onReady: () => void;
  onFailed: () => void;
  onTitlePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTitlePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTitlePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onTitlePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (
    handle: PreviewControllerResizeHandle,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  resizing?: boolean;
}

const RESIZE_HANDLES: Array<{
  handle: PreviewControllerResizeHandle;
  cursor: string;
  style: CSSProperties;
}> = [
  {
    handle: "n",
    cursor: "ns-resize",
    style: {
      top: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      left: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      right: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      height: PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE,
    },
  },
  {
    handle: "s",
    cursor: "ns-resize",
    style: {
      bottom: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      left: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      right: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      height: PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE,
    },
  },
  {
    handle: "e",
    cursor: "ew-resize",
    style: {
      top: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      right: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      bottom: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      width: PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE,
    },
  },
  {
    handle: "w",
    cursor: "ew-resize",
    style: {
      top: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      left: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      bottom: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      width: PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE,
    },
  },
  {
    handle: "ne",
    cursor: "nesw-resize",
    style: {
      top: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      right: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      width: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      height: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
    },
  },
  {
    handle: "nw",
    cursor: "nwse-resize",
    style: {
      top: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      left: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      width: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      height: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
    },
  },
  {
    handle: "se",
    cursor: "nwse-resize",
    style: {
      right: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      bottom: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      width: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      height: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
    },
  },
  {
    handle: "sw",
    cursor: "nesw-resize",
    style: {
      left: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      bottom: -(PREVIEW_WINDOW_RESIZE_EDGE_HIT_SIZE / 2),
      width: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
      height: PREVIEW_WINDOW_RESIZE_CORNER_HIT_SIZE,
    },
  },
];

export const PreviewControllerWindow = ({
  session,
  activeOpacity,
  highContrast = false,
  dragging = false,
  onFocus,
  onMinimize,
  onRemove,
  onRotate,
  onActiveOpacityChange,
  onReady,
  onFailed,
  onTitlePointerDown,
  onTitlePointerMove,
  onTitlePointerUp,
  onTitlePointerCancel,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
  resizing = false,
}: PreviewControllerWindowProps) => {
  const [windowHovered, setWindowHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isVisible = dragging || resizing || windowHovered;
  const windowOpacity = isVisible
    ? activeOpacity
    : Math.min(activeOpacity, 0.62);
  const settingsShelfHeight =
    settingsOpen && onActiveOpacityChange
      ? PREVIEW_WINDOW_SETTINGS_SHELF_HEIGHT
      : 0;
  const contentHeight = Math.max(
    session.height - PREVIEW_WINDOW_TITLEBAR_HEIGHT,
    0,
  );
  const nextOrientationLabel =
    session.orientation === "portrait" ? "landscape" : "portrait";
  const statusToneClassName =
    session.surfaceState === "failed"
      ? "bg-amber-300"
      : session.surfaceState === "ready"
        ? "bg-emerald-300"
        : "bg-white/45";

  return (
    <div
      className="absolute"
      style={{
        left: session.x,
        top: session.y,
        width: session.width,
        height: session.height + settingsShelfHeight,
        zIndex: session.zIndex,
        pointerEvents: "none",
      }}
      onPointerEnter={() => setWindowHovered(true)}
      onPointerLeave={() => setWindowHovered(false)}
    >
      <section
        className={cn(
          "relative overflow-hidden border-white/10 transition-opacity duration-150",
          shellPanelClassName,
          highContrast && "border-white/30",
          dragging && "shadow-[0_28px_90px_rgba(0,0,0,0.55)]",
        )}
        style={{
          width: "100%",
          height: "100%",
          opacity: windowOpacity,
          pointerEvents: "auto",
        }}
      >
        <div
          className="flex h-9 items-center gap-2 border-b border-white/8 px-2.5"
          style={{
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
          }}
          onPointerDown={onTitlePointerDown}
          onPointerMove={onTitlePointerMove}
          onPointerUp={onTitlePointerUp}
          onPointerCancel={onTitlePointerCancel}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <MonitorSmartphone className="h-3 w-3 text-white/80" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] leading-none font-semibold text-white/92">
                {session.label}
              </div>
            </div>
            <span
              className={cn(
                "ml-1 h-1.5 w-1.5 rounded-full",
                statusToneClassName,
              )}
              title={previewControllerWindowStateLabel[session.surfaceState]}
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRotate}
              aria-label={`Rotate ${session.label} to ${nextOrientationLabel}`}
              title={`Rotate to ${nextOrientationLabel}`}
            >
              <TabletSmartphone className="h-3.5 w-3.5" />
            </Button>
            {onActiveOpacityChange ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "h-6 w-6 rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white",
                  settingsOpen && "bg-white/[0.08] text-white",
                )}
                style={{ pointerEvents: "auto" }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSettingsOpen((current) => !current)}
                aria-label={`Adjust ${session.label} opacity`}
                title={`Adjust opacity (${Math.round(activeOpacity * 100)}%)`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onMinimize}
              aria-label={`Minimize ${session.label}`}
              title="Minimize controller"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white"
              style={{ pointerEvents: "auto" }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRemove}
              aria-label={`Close ${session.label}`}
              title="Close controller"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {settingsOpen && onActiveOpacityChange ? (
          <div
            className="border-b border-white/8 bg-black/72 px-3 py-2.5 backdrop-blur-sm"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-300 uppercase">
                Opacity
              </p>
              <span className="font-mono text-[11px] text-slate-400">
                {Math.round(activeOpacity * 100)}%
              </span>
            </div>
            <Slider
              value={[activeOpacity * 100]}
              onValueChange={(values) => onActiveOpacityChange(values[0] / 100)}
              min={35}
              max={100}
              step={1}
              aria-label="Preview controller opacity"
            />
          </div>
        ) : null}

        <div
          className="relative"
          onPointerDownCapture={() => {
            if (!session.active) {
              onFocus();
            }
          }}
        >
          <div
            className="relative overflow-hidden bg-black"
            style={{
              width: session.width,
              height: contentHeight,
            }}
          >
            <div
              className="origin-top-left"
              style={{
                width: session.viewportWidth,
                height: session.viewportHeight,
                transform: `scale(${session.displayScale})`,
                transformOrigin: "top left",
              }}
            >
              <iframe
                src={session.url}
                title={`${session.label} controller`}
                data-testid={`preview-controller-frame-${session.ordinal}`}
                className="border-none bg-black"
                style={{
                  width: session.viewportWidth,
                  height: session.viewportHeight,
                }}
                allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                onLoad={onReady}
                onError={onFailed}
              />
            </div>

            {session.surfaceState === "loading" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/34 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] text-slate-200 shadow-lg">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading
                </div>
              </div>
            ) : null}

            {session.surfaceState === "failed" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/84 px-5 text-center backdrop-blur-[2px]">
                <div className="max-w-[14rem] space-y-2.5">
                  <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/22 bg-amber-400/8 text-amber-200">
                    <TriangleAlert className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Controller did not load
                  </div>
                  <p className="text-[11px] leading-5 text-slate-300">
                    Close it and open a fresh controller once the route is ready
                    again.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {RESIZE_HANDLES.map(({ handle, cursor, style }) => (
        <div
          key={handle}
          data-testid={`preview-controller-resize-${handle}-${session.ordinal}`}
          className="absolute"
          style={{
            ...style,
            cursor,
            pointerEvents: "auto",
            touchAction: "none",
          }}
          onPointerDown={(event) => onResizePointerDown(handle, event)}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerCancel}
          title="Resize controller"
        />
      ))}
    </div>
  );
};
