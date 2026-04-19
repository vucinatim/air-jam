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
import type { CSSProperties, RefObject } from "react";
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
  controllerOrientation: ControllerOrientation;
  chromeInsetStyle?: CSSProperties;
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
  controllerOrientation,
  chromeInsetStyle,
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
  const mainInsetStyle = isPreview ? undefined : chromeInsetStyle;

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
          />
        ) : null}

        <ControllerMenuSheet
          routeRoomId={routeRoomId}
          activeUrl={activeUrl}
          controller={controller}
          emitArcadeAction={emitArcadeAction}
          controllerOrientation={controllerOrientation}
          documentFullscreen={documentFullscreen}
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
        style={mainInsetStyle}
      >
        {activeUrl ? (
          <ControllerGameFrame
            iframeRef={iframeRef}
            controllerIframeSrc={controllerIframeSrc}
            controllerIframePending={controllerIframePending}
            controllerIframeFailed={controllerIframeFailed}
            chromeInsetStyle={mainInsetStyle}
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

  if (isPreview) {
    return (
      <div className="relative flex h-dvh w-dvw flex-col overflow-hidden bg-black">
        {layout}
      </div>
    );
  }

  return (
    <div className="dark">
      {!activeUrl ? (
        <SurfaceViewport
          orientation="portrait"
          contentClassName="h-full w-full bg-black"
        >
          {layout}
        </SurfaceViewport>
      ) : (
        <div className="relative flex h-dvh w-dvw flex-col bg-black">
          {layout}
        </div>
      )}
    </div>
  );
}
