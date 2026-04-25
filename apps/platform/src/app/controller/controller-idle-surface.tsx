"use client";

import { RemoteDPad } from "@/components/remote-d-pad";
import { Button } from "@/components/ui/button";
import type { AirJamControllerApi } from "@air-jam/sdk";
import { BellRing, CornerDownLeft } from "lucide-react";
import type { CSSProperties } from "react";

interface ControllerIdleSurfaceProps {
  controller: AirJamControllerApi;
  hapticsEnabled: boolean;
  onMove: (vector: { x: number; y: number }) => void;
  onConfirm: () => void;
  onConfirmRelease: () => void;
  onPing: () => void;
}

const idleSurfaceStyle: CSSProperties = {
  gap: "clamp(0.75rem, calc(var(--airjam-reference-height, 100dvh) * 0.025), 2rem)",
  paddingTop:
    "clamp(5rem, calc(var(--airjam-reference-height, 100dvh) * 0.12), 6rem)",
  paddingBottom:
    "clamp(1rem, calc(var(--airjam-reference-height, 100dvh) * 0.04), 3rem)",
};

const titleStyle: CSSProperties = {
  fontSize:
    "clamp(1.875rem, calc(var(--airjam-reference-width, 100dvw) * 0.08), 2.25rem)",
};

const subtitleStyle: CSSProperties = {
  fontSize:
    "clamp(1.25rem, calc(var(--airjam-reference-width, 100dvw) * 0.055), 1.5rem)",
};

export function ControllerIdleSurface({
  controller,
  hapticsEnabled,
  onMove,
  onConfirm,
  onConfirmRelease,
  onPing,
}: ControllerIdleSurfaceProps) {
  return (
    <div
      className="relative z-10 flex h-full min-h-0 w-full flex-col items-center justify-between overflow-hidden px-4"
      style={idleSurfaceStyle}
    >
      <div className="shrink-0 text-center opacity-30">
        <h1
          className="leading-none font-black tracking-tighter uppercase select-none"
          style={titleStyle}
        >
          Air Jam
        </h1>
        <p
          className="text-primary leading-tight font-black tracking-wider uppercase"
          style={subtitleStyle}
        >
          Arcade
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <RemoteDPad
          onMove={onMove}
          onConfirm={onConfirm}
          onConfirmRelease={onConfirmRelease}
          hapticsEnabled={hapticsEnabled}
        />
      </div>

      {controller.connectionStatus === "connected" && controller.roomId ? (
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="border-airjam-cyan/40 bg-airjam-cyan/8 text-airjam-cyan hover:bg-airjam-cyan/14 focus-visible:border-airjam-cyan focus-visible:bg-airjam-cyan/14 focus-visible:ring-airjam-cyan/35 active:border-airjam-cyan active:bg-airjam-cyan/20 min-w-48 shrink-0 px-6 transition-all duration-150 active:scale-[0.98] active:shadow-[0_0_24px_rgba(34,211,238,0.22)]"
          data-testid="controller-arcade-ping"
          onClick={onPing}
        >
          <BellRing className="mr-2 h-4 w-4" />
          Ping host
        </Button>
      ) : null}

      <div className="text-muted-foreground flex shrink-0 flex-col items-center gap-2 text-center text-sm opacity-50">
        <p>Use the remote to navigate</p>
        <p className="mt-0.5 flex items-center justify-center gap-1.5">
          <span>Press</span>
          <CornerDownLeft
            className="inline-block h-5 w-5 shrink-0 text-neutral-400 opacity-70"
            aria-label="the center button"
          />
          <span>to select</span>
        </p>
      </div>
    </div>
  );
}
