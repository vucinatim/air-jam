"use client";

import { Button } from "@/components/ui/button";
import {
  HOSTED_RELEASE_IFRAME_PERMISSIONS,
  HOSTED_RELEASE_IFRAME_SANDBOX,
} from "@/lib/releases/hosted-release-frame-policy";
import type { RefObject } from "react";

interface ControllerGameFrameProps {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  controllerIframeSrc: string | null;
  controllerIframePending: boolean;
  controllerIframeFailed: boolean;
  controllerIframeLoading: boolean;
  controllerIframeRevision: number;
  onRetry: () => void;
}

export function ControllerGameFrame({
  iframeRef,
  controllerIframeSrc,
  controllerIframePending,
  controllerIframeFailed,
  controllerIframeLoading,
  controllerIframeRevision,
  onRetry,
}: ControllerGameFrameProps) {
  return (
    <div className="bg-background absolute inset-0 z-20">
      {controllerIframePending ? (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-muted-foreground text-sm">
            Loading your controller…
          </p>
        </div>
      ) : controllerIframeSrc ? (
        <iframe
          key={controllerIframeRevision}
          ref={iframeRef}
          src={controllerIframeSrc}
          title="Air Jam controller game"
          data-testid="arcade-controller-game-frame"
          className="h-full w-full border-none bg-black"
          style={{ backgroundColor: "#000000" }}
          allow={HOSTED_RELEASE_IFRAME_PERMISSIONS}
          sandbox={HOSTED_RELEASE_IFRAME_SANDBOX}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center">
          <p className="text-muted-foreground text-sm">
            This game’s controller is unavailable. Open the Air Jam menu to
            return to the Arcade and choose another game.
          </p>
        </div>
      )}

      {controllerIframeSrc &&
      controllerIframeLoading &&
      !controllerIframeFailed ? (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center text-sm text-zinc-300"
        >
          Loading your controller…
        </div>
      ) : null}

      {controllerIframeFailed ? (
        <div
          role="status"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/78 px-6 text-center"
        >
          <div className="max-w-sm rounded-3xl border border-amber-400/30 bg-zinc-950/95 px-5 py-6 text-left shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
            <div className="text-[10px] tracking-[0.22em] text-amber-300/80 uppercase">
              Still loading
            </div>
            <div className="mt-3 text-sm font-semibold text-white">
              Your controller is taking longer than expected.
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              You’re connected to the room. You can keep waiting or reload your
              controller without leaving the game.
            </p>
            <Button className="mt-5" size="touch" onClick={onRetry}>
              Reload controller
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
