"use client";

import { ControllerFullscreenPrompt } from "@/components/controller-fullscreen-prompt";
import { ControllerMenuSheet } from "@/components/controller-menu-sheet";
import { cn } from "@/lib/utils";
import type {
  AirJamControllerApi,
  ControllerOrientation,
  PlatformSettingsSnapshot,
} from "@air-jam/sdk";
import { SurfaceViewport } from "@air-jam/sdk/ui";
import { useState, type RefObject } from "react";
import { ControllerGameFrame } from "./controller-game-frame";
import { ControllerIdleSurface } from "./controller-idle-surface";

export type ControllerPageSurfaceMode = "default" | "preview";

interface ControllerPageLayoutProps {
  surfaceMode: ControllerPageSurfaceMode;
  routeRoomId: string | null;
  documentFullscreen: boolean;
  activeUrl: string | null;
  controller: AirJamControllerApi;
  emitArcadeAction: (action: string, payload?: Record<string, unknown>) => void;
  hasControllerCapability: boolean;
  controllerOrientation: ControllerOrientation;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  controllerIframeSrc: string | null;
  controllerIframePending: boolean;
  controllerIframeFailed: boolean;
  hostQrVisible: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  sharedPlatformSettings: PlatformSettingsSnapshot | null;
  onUpdateSharedPlatformSettings: (patch: {
    audio?: Partial<PlatformSettingsSnapshot["audio"]>;
    accessibility?: Partial<PlatformSettingsSnapshot["accessibility"]>;
    feedback?: Partial<PlatformSettingsSnapshot["feedback"]>;
  }) => void;
  onMove: (vector: { x: number; y: number }) => void;
  onConfirm: () => void;
  onConfirmRelease: () => void;
  onPing: () => void;
}

export function ControllerPageLayout({
  surfaceMode,
  routeRoomId,
  documentFullscreen,
  activeUrl,
  controller,
  emitArcadeAction,
  hasControllerCapability,
  controllerOrientation,
  iframeRef,
  controllerIframeSrc,
  controllerIframePending,
  controllerIframeFailed,
  hostQrVisible,
  hapticsEnabled,
  reducedMotion,
  highContrast,
  sharedPlatformSettings,
  onUpdateSharedPlatformSettings,
  onMove,
  onConfirm,
  onConfirmRelease,
  onPing,
}: ControllerPageLayoutProps) {
  const isPreview = surfaceMode === "preview";
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const controllerSurfaceOrientation: ControllerOrientation = activeUrl
    ? controllerOrientation
    : "portrait";

  const layout = (
    <div
      className={cn(
        "text-foreground relative flex h-full min-h-0 w-full touch-none flex-col overflow-hidden bg-black select-none",
        highContrast && "contrast-125",
      )}
    >
      <>
        {!isPreview ? (
          <ControllerFullscreenPrompt
            roomId={routeRoomId}
            documentFullscreen={documentFullscreen}
            portalContainer={portalContainer}
          />
        ) : null}

        <ControllerMenuSheet
          routeRoomId={routeRoomId}
          activeUrl={activeUrl}
          controller={controller}
          emitArcadeAction={emitArcadeAction}
          hasControllerCapability={hasControllerCapability}
          documentFullscreen={documentFullscreen}
          dialogPortalContainer={portalContainer}
          hostQrVisible={hostQrVisible}
          hapticsEnabled={hapticsEnabled}
          reducedMotion={reducedMotion}
          highContrast={highContrast}
          sharedPlatformSettings={sharedPlatformSettings}
          onUpdateSharedPlatformSettings={onUpdateSharedPlatformSettings}
        />
      </>

      <main
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
          !isPreview && "sm:p-4",
        )}
      >
        {activeUrl ? (
          <ControllerGameFrame
            iframeRef={iframeRef}
            controllerIframeSrc={controllerIframeSrc}
            controllerIframePending={controllerIframePending}
            controllerIframeFailed={controllerIframeFailed}
          />
        ) : (
          <ControllerIdleSurface
            controller={controller}
            hapticsEnabled={hapticsEnabled}
            onMove={onMove}
            onConfirm={onConfirm}
            onConfirmRelease={onConfirmRelease}
            onPing={onPing}
          />
        )}
      </main>
    </div>
  );

  const framedLayout = (
    <SurfaceViewport
      orientation={controllerSurfaceOrientation}
      lockOnGesture={!isPreview}
      contentClassName="h-full w-full bg-black"
    >
      <div
        ref={setPortalContainer}
        className="relative h-full w-full overflow-hidden bg-black"
      >
        {layout}
      </div>
    </SurfaceViewport>
  );

  if (isPreview) {
    return (
      <div className="dark relative flex h-dvh w-dvw flex-col overflow-hidden bg-black">
        {framedLayout}
      </div>
    );
  }

  return <div className="dark">{framedLayout}</div>;
}
