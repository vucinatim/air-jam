import { Button } from "../components/ui/button";
import { cn } from "../utils/cn";
import { MonitorSmartphone, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { shellUtilityButtonClassName } from "../components/shell-classes";
import { PREVIEW_WORKSPACE_Z_INDEX } from "./layout";
import { usePreviewControllerManager } from "./manager";
import { PreviewControllerWindow } from "./window";

export interface PreviewControllerWorkspaceProps {
  joinUrl: string | null;
  enabled?: boolean;
  highContrast?: boolean;
  className?: string;
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

export const PreviewControllerWorkspace = ({
  joinUrl,
  enabled = false,
  highContrast = false,
  className,
  maxControllers = 2,
  launcherLabel = "Open controller",
  waitingLabel = "Waiting for room",
}: PreviewControllerWorkspaceProps) => {
  const [mounted, setMounted] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const {
    sessions,
    canSpawn,
    spawnPreviewController,
    removePreviewController,
    minimizePreviewController,
    restorePreviewController,
    focusPreviewController,
    setPreviewControllerPosition,
    markPreviewControllerReady,
    markPreviewControllerFailed,
  } = usePreviewControllerManager({
    joinUrl,
    enabled,
    maxControllers,
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
          highContrast={highContrast}
          dragging={dragState?.id === session.id}
          onFocus={() => focusPreviewController(session.id)}
          onMinimize={() => minimizePreviewController(session.id)}
          onRemove={() => removePreviewController(session.id)}
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
        />
      ))}

      <div
        className={cn(
          "fixed right-4 bottom-4 flex items-center justify-end gap-2 sm:right-6 sm:bottom-6",
          className,
        )}
        style={{ pointerEvents: "none", maxWidth: "calc(100vw - 2rem)" }}
      >
        {minimizedSessions.length > 0 ? (
          <div
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-2 text-white shadow-[0_18px_48px_rgba(0,0,0,0.34)] backdrop-blur-md"
            style={{ pointerEvents: "auto" }}
          >
            {minimizedSessions.map((session) => (
              <Button
                key={session.id}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[11px] font-semibold text-white/84 hover:bg-white/[0.1] hover:text-white"
                onClick={() => restorePreviewController(session.id)}
                title={`Restore ${session.label}`}
              >
                {session.label}
              </Button>
            ))}
          </div>
        ) : null}

          <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 rounded-full px-4 text-sm",
            "border-white/10 bg-black/55 text-white/88 shadow-[0_20px_55px_rgba(0,0,0,0.4)] backdrop-blur-md hover:bg-black/72 hover:text-white disabled:border-white/8 disabled:bg-black/40 disabled:text-white/40",
            shellUtilityButtonClassName,
          )}
          style={{ pointerEvents: "auto" }}
          disabled={!canSpawn}
          onClick={() => {
            spawnPreviewController();
          }}
          title={!joinUrl ? waitingLabel : launcherLabel}
        >
          <MonitorSmartphone className="h-4 w-4" />
          <Plus className="h-3.5 w-3.5 text-white/60" />
          {launcherLabel}
        </Button>
      </div>
    </div>,
    document.body,
  );
};
