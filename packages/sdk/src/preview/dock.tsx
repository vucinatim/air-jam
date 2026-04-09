import { Button } from "../components/ui/button";
import { cn } from "../utils/cn";
import { ChevronDown, ChevronUp, MonitorSmartphone, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { usePreviewControllerManager } from "./manager";
import { PreviewControllerSurface } from "./surface";

const DEFAULT_MAX_PREVIEW_CONTROLLERS = 2;

export interface PreviewControllerDockProps {
  joinUrl: string | null;
  enabled?: boolean;
  highContrast?: boolean;
  className?: string;
  maxControllers?: number;
  title?: string;
  emptyLabel?: string;
  waitingLabel?: string;
}

export const PreviewControllerDock = ({
  joinUrl,
  enabled = false,
  highContrast = false,
  className,
  maxControllers = DEFAULT_MAX_PREVIEW_CONTROLLERS,
  title = "Preview Controllers",
  emptyLabel = "No previews open",
  waitingLabel = "Waiting for room",
}: PreviewControllerDockProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    sessions,
    canSpawn,
    spawnPreviewController,
    removePreviewController,
    setPreviewControllerExpanded,
    focusPreviewController,
    markPreviewControllerReady,
    markPreviewControllerFailed,
  } = usePreviewControllerManager({
    joinUrl,
    enabled,
    maxControllers,
  });

  const statusText = useMemo(() => {
    if (!joinUrl) {
      return waitingLabel;
    }
    if (sessions.length === 0) {
      return emptyLabel;
    }
    if (sessions.length >= maxControllers) {
      return `At limit (${maxControllers})`;
    }
    return `${sessions.length} active`;
  }, [emptyLabel, joinUrl, maxControllers, sessions.length, waitingLabel]);

  if (!enabled) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 bottom-4 z-40 flex max-w-[min(26rem,calc(100vw-2rem))] flex-col items-end gap-3 sm:right-6 sm:bottom-6",
        className,
      )}
    >
      {!collapsed && sessions.length > 0 ? (
        <div className="flex w-full flex-col items-end gap-3">
          {sessions.map((session) => (
            <PreviewControllerSurface
              key={session.id}
              session={session}
              highContrast={highContrast}
              onToggleExpanded={() =>
                setPreviewControllerExpanded(session.id, !session.expanded)
              }
              onFocus={() => focusPreviewController(session.id)}
              onRemove={() => removePreviewController(session.id)}
              onReady={() => markPreviewControllerReady(session.id)}
              onFailed={() => markPreviewControllerFailed(session.id)}
            />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "pointer-events-auto flex min-h-14 items-center gap-3 rounded-full border border-white/12 bg-black/84 px-3 py-2 text-white shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-md",
          highContrast && "border-white/30",
        )}
      >
        <div className="flex items-center gap-3 pl-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/6">
            <MonitorSmartphone className="h-4.5 w-4.5 text-cyan-300" />
          </div>
          <div className="hidden min-w-0 sm:block">
            <div className="text-sm font-semibold tracking-tight">{title}</div>
            <div className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
              {statusText}
            </div>
          </div>
        </div>

        {sessions.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-9 rounded-full text-white hover:bg-white/10"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Show preview controllers" : "Hide preview controllers"}
            title={collapsed ? "Show preview controllers" : "Hide preview controllers"}
          >
            {collapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full border-white/12 bg-white/6 px-4 text-sm text-white hover:bg-white/10"
          disabled={!canSpawn}
          onClick={() => {
            setCollapsed(false);
            spawnPreviewController();
          }}
        >
          <Plus className="h-4 w-4" />
          Add controller
        </Button>
      </div>
    </div>
  );
};
