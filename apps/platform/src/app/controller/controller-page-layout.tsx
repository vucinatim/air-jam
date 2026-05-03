"use client";

import { ControllerFullscreenPrompt } from "@/components/controller-fullscreen-prompt";
import { ControllerMenuSheet } from "@/components/controller-menu-sheet";
import type {
  ControllerLocalSettingsSnapshot,
} from "@/lib/controller-local-settings";
import { cn } from "@/lib/utils";
import type {
  AirJamControllerApi,
  ControllerOrientation,
  PartialRoomPlatformSettingsPatch,
  RoomPlatformSettingsSnapshot,
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
  emitArcadeAction: (action: string, payload?: unknown) => void;
  hasControllerCapability: boolean;
  controllerOrientation: ControllerOrientation;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  controllerIframeSrc: string | null;
  controllerIframePending: boolean;
  controllerIframeFailed: boolean;
  hostQrVisible: boolean;
  hapticsEnabled: boolean;
  roomPlatformSettings: RoomPlatformSettingsSnapshot | null;
  roomPlatformSettingsReadOnly: boolean;
  onUpdateRoomPlatformSettings: (patch: PartialRoomPlatformSettingsPatch) => void;
  controllerLocalSettings: ControllerLocalSettingsSnapshot;
  onUpdateControllerLocalSettings: (
    patch: Partial<ControllerLocalSettingsSnapshot>,
  ) => void;
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
  roomPlatformSettings,
  roomPlatformSettingsReadOnly,
  onUpdateRoomPlatformSettings,
  controllerLocalSettings,
  onUpdateControllerLocalSettings,
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
        "text-foreground relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black select-none",
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
          roomPlatformSettings={roomPlatformSettings}
          roomPlatformSettingsReadOnly={roomPlatformSettingsReadOnly}
          onUpdateRoomPlatformSettings={onUpdateRoomPlatformSettings}
          controllerLocalSettings={controllerLocalSettings}
          onUpdateControllerLocalSettings={onUpdateControllerLocalSettings}
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
