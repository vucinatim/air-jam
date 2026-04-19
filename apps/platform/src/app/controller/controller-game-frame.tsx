"use client";

import type { RefObject } from "react";

interface ControllerGameFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  controllerIframeSrc: string | null;
  controllerIframePending: boolean;
  controllerIframeFailed: boolean;
}

export function ControllerGameFrame({
  iframeRef,
  controllerIframeSrc,
  controllerIframePending,
  controllerIframeFailed,
}: ControllerGameFrameProps) {
  return (
    <div className="bg-background absolute inset-0 z-20">
      {controllerIframePending ? (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Preparing controller bridge…
          </p>
        </div>
      ) : controllerIframeSrc ? (
        <iframe
          ref={iframeRef}
          src={controllerIframeSrc}
          title="Air Jam controller game"
          data-testid="arcade-controller-game-frame"
          className="h-full w-full border-none bg-black"
          style={{ backgroundColor: "#000000" }}
          allow="vibrate; gyroscope; accelerometer; autoplay; fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Unable to load game controller UI due to invalid runtime URL.
          </p>
        </div>
      )}

      {controllerIframeFailed ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/78 px-6 text-center">
          <div className="max-w-sm rounded-3xl border border-amber-400/30 bg-zinc-950/95 px-5 py-6 text-left shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="text-[10px] tracking-[0.22em] text-amber-300/80 uppercase">
              Controller Load Blocked
            </div>
            <div className="mt-3 text-sm font-semibold text-white">
              The game controller UI did not finish loading.
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              The platform controller shell is connected, but the embedded game
              controller iframe never attached through the local Arcade test
              route.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">
              Reload the controller from a fresh room after the local Arcade
              test build finishes. If this keeps failing, inspect the local
              build route instead of the live game dev server.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
