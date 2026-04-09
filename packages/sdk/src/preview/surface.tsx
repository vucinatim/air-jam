import { Button } from "../components/ui/button";
import { cn } from "../utils/cn";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MonitorSmartphone,
  TriangleAlert,
  X,
} from "lucide-react";
import type { PreviewControllerSession } from "./manager";

export const previewControllerSurfaceStateLabel: Record<
  PreviewControllerSession["surfaceState"],
  string
> = {
  loading: "Loading",
  ready: "Ready",
  failed: "Load blocked",
};

export interface PreviewControllerSurfaceProps {
  session: PreviewControllerSession;
  highContrast?: boolean;
  onToggleExpanded: () => void;
  onFocus: () => void;
  onRemove: () => void;
  onReady: () => void;
  onFailed: () => void;
}

export const PreviewControllerSurface = ({
  session,
  highContrast = false,
  onToggleExpanded,
  onFocus,
  onRemove,
  onReady,
  onFailed,
}: PreviewControllerSurfaceProps) => {
  const statusToneClassName =
    session.surfaceState === "failed"
      ? "text-amber-300"
      : session.surfaceState === "ready"
        ? "text-emerald-300"
        : "text-slate-300";

  return (
    <section
      className={cn(
        "pointer-events-auto w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/12 bg-black/82 text-white shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-md",
        highContrast && "border-white/30",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/12 bg-white/6">
            <MonitorSmartphone className="h-4 w-4 text-cyan-300" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              {session.label}
            </div>
            <div
              className={cn(
                "text-[11px] tracking-[0.18em] uppercase",
                statusToneClassName,
              )}
            >
              {previewControllerSurfaceStateLabel[session.surfaceState]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10"
            onClick={session.expanded ? onToggleExpanded : onFocus}
            aria-label={session.expanded ? "Collapse preview" : "Open preview"}
            title={session.expanded ? "Collapse preview" : "Open preview"}
          >
            {session.expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10"
            onClick={onRemove}
            aria-label="Close preview controller"
            title="Close preview controller"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {session.expanded ? (
        <div className="border-t border-white/10 px-3 pt-3 pb-3">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-black">
            <div className="aspect-[9/16] w-full">
              <iframe
                src={session.url}
                title={`${session.label} controller`}
                data-testid={`preview-controller-frame-${session.ordinal}`}
                className="h-full w-full border-none bg-black"
                allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
                onLoad={onReady}
                onError={onFailed}
              />
            </div>

            {session.surfaceState === "loading" ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/44">
                <div className="flex items-center gap-2 rounded-full border border-white/12 bg-black/70 px-3 py-2 text-xs text-slate-200 shadow-lg">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading controller
                </div>
              </div>
            ) : null}

            {session.surfaceState === "failed" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/82 px-6 text-center">
                <div className="max-w-xs space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
                    <TriangleAlert className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    Preview controller did not load
                  </div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Close this preview and add a fresh controller once the local
                    controller route is available again.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
