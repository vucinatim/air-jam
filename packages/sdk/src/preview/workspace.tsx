import {
  ChevronDown,
  ChevronUp,
  MonitorSmartphone,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  shellInsetPanelClassName,
  shellPanelClassName,
  shellUtilityButtonClassName,
} from "../components/shell-classes";
import { Button } from "../components/ui/button";
import { useResolvedPlatformSettingsSnapshot } from "../settings/platform-settings-runtime";
import { cn } from "../utils/cn";
import {
  getResizedPreviewBounds,
  PREVIEW_WORKSPACE_Z_INDEX,
  type PreviewControllerBounds,
  type PreviewControllerResizeHandle,
} from "./layout";
import { usePreviewControllerManager } from "./manager";
import {
  PreviewControllerWindow,
  previewControllerWindowStateLabel,
} from "./window";

export interface PreviewControllerWorkspaceProps {
  joinUrl: string | null;
  enabled?: boolean;
  highContrast?: boolean;
  onActiveOpacityChange?: (opacity: number) => void;
  className?: string;
  dockAccessory?: ReactNode;
  maxControllers?: number;
  launcherLabel?: string;
  waitingLabel?: string;
}

interface DragState {
  id: string;
  originX: number;
  originY: number;
  startClientX: number;
  startClientY: number;
  pointerId: number;
}

interface ResizeState {
  id: string;
  handle: PreviewControllerResizeHandle;
  originBounds: PreviewControllerBounds;
  startClientX: number;
  startClientY: number;
  pointerId: number;
}

export const PreviewControllerWorkspace = ({
  joinUrl,
  enabled = false,
  highContrast = false,
  onActiveOpacityChange,
  className,
  dockAccessory,
  maxControllers = 2,
  launcherLabel = "Controllers",
  waitingLabel = "Waiting for room",
}: PreviewControllerWorkspaceProps) => {
  const [mounted, setMounted] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const {
    sessions,
    canSpawn,
    spawnPreviewController,
    clearPreviewControllers,
    removePreviewController,
    minimizePreviewController,
    restorePreviewController,
    focusPreviewController,
    setPreviewControllerPosition,
    setPreviewControllerBounds,
    rotatePreviewController,
    markPreviewControllerReady,
    markPreviewControllerFailed,
  } = usePreviewControllerManager({
    joinUrl,
    enabled,
    maxControllers,
  });
  const platformSettings = useResolvedPlatformSettingsSnapshot();
  const activeOpacity = platformSettings.previewControllers.activeOpacity;
  const sortedSessions = useMemo(
    () => [...sessions].sort((left, right) => left.ordinal - right.ordinal),
    [sessions],
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!launcherOpen || typeof document === "undefined") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (dockRef.current?.contains(target)) {
        return;
      }

      setLauncherOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLauncherOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [launcherOpen]);

  const minimizedSessions = useMemo(
    () =>
      sessions
        .filter((session) => session.minimized)
        .sort((left, right) => left.ordinal - right.ordinal),
    [sessions],
  );
  const openSessions = useMemo(
    () => sessions.filter((session) => !session.minimized),
    [sessions],
  );

  if (!enabled || !mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0"
      style={{ zIndex: PREVIEW_WORKSPACE_Z_INDEX, pointerEvents: "none" }}
    >
      {openSessions.map((session) => (
        <PreviewControllerWindow
          key={session.id}
          session={session}
          activeOpacity={activeOpacity}
          highContrast={highContrast}
          dragging={dragState?.id === session.id}
          resizing={resizeState?.id === session.id}
          onFocus={() => focusPreviewController(session.id)}
          onMinimize={() => minimizePreviewController(session.id)}
          onRemove={() => removePreviewController(session.id)}
          onRotate={() => rotatePreviewController(session.id)}
          onActiveOpacityChange={onActiveOpacityChange}
          onReady={() => markPreviewControllerReady(session.id)}
          onFailed={() => markPreviewControllerFailed(session.id)}
          onTitlePointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            focusPreviewController(session.id);
            setDragState({
              id: session.id,
              originX: session.x,
              originY: session.y,
              startClientX: event.clientX,
              startClientY: event.clientY,
              pointerId: event.pointerId,
            });
            event.preventDefault();
          }}
          onTitlePointerMove={(event) => {
            if (
              resizeState ||
              !dragState ||
              dragState.id !== session.id ||
              dragState.pointerId !== event.pointerId
            ) {
              return;
            }

            setPreviewControllerPosition(
              dragState.id,
              dragState.originX + (event.clientX - dragState.startClientX),
              dragState.originY + (event.clientY - dragState.startClientY),
            );
          }}
          onTitlePointerUp={(event) => {
            if (dragState?.pointerId !== event.pointerId) {
              return;
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setDragState(null);
          }}
          onTitlePointerCancel={(event) => {
            if (dragState?.pointerId !== event.pointerId) {
              return;
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setDragState(null);
          }}
          onResizePointerDown={(handle, event) => {
            if (event.button !== 0) {
              return;
            }

            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            focusPreviewController(session.id);
            setResizeState({
              id: session.id,
              handle,
              originBounds: {
                x: session.x,
                y: session.y,
                width: session.width,
                height: session.height,
              },
              startClientX: event.clientX,
              startClientY: event.clientY,
              pointerId: event.pointerId,
            });
            event.preventDefault();
          }}
          onResizePointerMove={(event) => {
            if (
              !resizeState ||
              resizeState.id !== session.id ||
              resizeState.pointerId !== event.pointerId
            ) {
              return;
            }

            setPreviewControllerBounds(
              resizeState.id,
              getResizedPreviewBounds(
                resizeState.originBounds,
                resizeState.handle,
                event.clientX - resizeState.startClientX,
                event.clientY - resizeState.startClientY,
              ),
              {
                preserveRight: resizeState.handle.includes("w"),
                preserveBottom: resizeState.handle.includes("n"),
              },
            );
          }}
          onResizePointerUp={(event) => {
            if (resizeState?.pointerId !== event.pointerId) {
              return;
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setResizeState(null);
          }}
          onResizePointerCancel={(event) => {
            if (resizeState?.pointerId !== event.pointerId) {
              return;
            }

            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setResizeState(null);
          }}
        />
      ))}

      <div
        ref={dockRef}
        className={cn(
          "fixed flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2",
          className ?? "right-4 bottom-4 sm:right-6 sm:bottom-6",
        )}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="flex items-start justify-end gap-2"
          style={{ pointerEvents: "auto" }}
        >
          {dockAccessory}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-full border border-white/25 bg-black/35 px-3 text-white backdrop-blur-sm hover:bg-black/55 disabled:border-white/10 disabled:bg-black/25 disabled:text-white/40",
            )}
            aria-expanded={launcherOpen}
            aria-label={
              launcherOpen
                ? "Hide preview controllers"
                : "Show preview controllers"
            }
            title={!joinUrl ? waitingLabel : launcherLabel}
            onClick={() => setLauncherOpen((current) => !current)}
          >
            <MonitorSmartphone className="h-4 w-4" />
            <span className="text-[11px] font-semibold tracking-[0.16em] uppercase">
              {launcherLabel}
            </span>
            <span className="rounded-full border border-white/12 bg-white/6 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white/88">
              {sessions.length}
            </span>
            {launcherOpen ? (
              <ChevronUp className="h-4 w-4 text-white/60" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/60" />
            )}
          </Button>
        </div>

        {launcherOpen ? (
          <section
            className={cn(
              "w-88 max-w-[calc(100vw-2rem)] overflow-hidden p-4",
              shellPanelClassName,
              highContrast && "border-white/30",
            )}
            style={{ pointerEvents: "auto" }}
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-white/54 uppercase">
                      Preview controllers
                    </p>
                    <p className="mt-2 text-sm text-white/86">
                      {sessions.length === 0
                        ? "No preview controllers yet"
                        : `${sessions.length} controller${sessions.length === 1 ? "" : "s"} available`}
                    </p>
                  </div>
                  {sessions.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 shrink-0 rounded-full text-white/72 hover:bg-white/8 hover:text-white"
                      onClick={() => clearPreviewControllers()}
                      title="Close all preview controllers"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="h-px bg-white/10" />
              </div>

              <div className="space-y-4">
                {sortedSessions.length > 0 ? (
                  <div className="space-y-3">
                    {sortedSessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-2xl px-3 py-2.5",
                          shellInsetPanelClassName,
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-white/92">
                              {session.label}
                            </span>
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                session.surfaceState === "failed"
                                  ? "bg-amber-300"
                                  : session.surfaceState === "ready"
                                    ? "bg-emerald-300"
                                    : "bg-white/45",
                              )}
                            />
                          </div>
                          <p className="mt-1 text-[10px] tracking-[0.14em] text-white/50 uppercase">
                            {session.minimized
                              ? "Minimized"
                              : session.active
                                ? "Focused"
                                : previewControllerWindowStateLabel[
                                    session.surfaceState
                                  ]}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 rounded-full px-3 text-[10px]",
                              shellUtilityButtonClassName,
                            )}
                            onClick={() =>
                              session.minimized
                                ? restorePreviewController(session.id)
                                : focusPreviewController(session.id)
                            }
                          >
                            {session.minimized ? "Restore" : "Focus"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 rounded-full text-white/68 hover:bg-white/8 hover:text-white"
                            onClick={() => removePreviewController(session.id)}
                            title={`Close ${session.label}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn("px-4 py-4", shellInsetPanelClassName)}>
                    <p className="text-sm leading-6 text-white/58">
                      Open a controller preview here to test the host flow
                      without using a phone.
                    </p>
                  </div>
                )}

                {minimizedSessions.length > 0 ? (
                  <p className="text-[11px] tracking-[0.14em] text-white/46 uppercase">
                    {minimizedSessions.length} minimized
                  </p>
                ) : null}

                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "h-10 w-full rounded-2xl",
                    shellUtilityButtonClassName,
                  )}
                  disabled={!canSpawn}
                  onClick={() => {
                    spawnPreviewController();
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {!joinUrl ? waitingLabel : "Add controller"}
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};
