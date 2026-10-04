"use client";

import { useArcadeSurfaceStore } from "@/components/arcade/arcade-surface-store";
import {
  getControllerLocalProfileClientSnapshot,
  writeControllerLocalProfile,
} from "@/lib/controller-local-profile";
import {
  useControllerLocalSettings,
  type ControllerLocalSettingsSnapshot,
} from "@/lib/controller-local-settings";
import { triggerLocalHaptic } from "@/lib/local-haptics";
import { useDocumentFullscreen } from "@/lib/use-document-fullscreen";
import {
  useAirJamController,
  type PartialRoomPlatformSettingsPatch,
} from "@air-jam/sdk";
import { AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN } from "@air-jam/sdk/arcade/surface";
import { airJamArcadePlatformActions } from "@air-jam/sdk/protocol";
import { useCallback, useEffect, useRef } from "react";
import {
  ControllerPageLayout,
  type ControllerPageSurfaceMode,
} from "./controller-page-layout";
import { useControllerEmbeddedGameFrame } from "./use-controller-embedded-game-frame";

interface ControllerPageContentProps {
  routeRoomId: string | null;
  hasControllerCapability: boolean;
  surfaceMode: ControllerPageSurfaceMode;
}

export function ControllerPageContent({
  routeRoomId,
  hasControllerCapability,
  surfaceMode,
}: ControllerPageContentProps) {
  const documentFullscreen = useDocumentFullscreen();
  const controller = useAirJamController();
  const { settings: controllerLocalSettings, updateSettings } =
    useControllerLocalSettings();

  const {
    activeUrl,
    hostQrVisible,
    controllerPresentationOrientation,
    controllerIframeSrc,
    controllerIframePending,
    controllerIframeFailed,
    controllerIframeLoading,
    controllerIframeRevision,
    retryControllerFrame,
    iframeRef,
  } = useControllerEmbeddedGameFrame({
    controller,
  });

  const navigationHeldRef = useRef(false);
  const confirmHeldRef = useRef(false);
  useEffect(() => {
    // Switching away from the remote can remove it before pointer-up arrives.
    // Discard that gesture; returning to the menu must require a fresh press.
    navigationHeldRef.current = false;
    confirmHeldRef.current = false;
  }, [activeUrl, controller.connectionStatus, controller.roomId]);
  const selfPlayerLabel = controller.selfPlayer?.label?.trim() ?? "";
  const selfPlayerAvatarId = controller.selfPlayer?.avatarId?.trim() ?? "";

  useEffect(() => {
    if (!selfPlayerLabel) {
      return;
    }

    const currentProfile = getControllerLocalProfileClientSnapshot();
    const nextProfile = {
      label: selfPlayerLabel.slice(0, 24),
      avatarId: selfPlayerAvatarId || currentProfile.avatarId,
    };

    if (
      currentProfile.label === nextProfile.label &&
      currentProfile.avatarId === nextProfile.avatarId
    ) {
      return;
    }

    writeControllerLocalProfile(nextProfile);
  }, [selfPlayerAvatarId, selfPlayerLabel]);

  const emitArcadeAction = useCallback(
    (actionName: string, payload?: unknown) => {
      if (
        !controller.socket ||
        !controller.socket.connected ||
        !controller.roomId
      ) {
        return;
      }

      controller.socket.emit("controller:action_rpc", {
        roomId: controller.roomId,
        actionName,
        payload,
        storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
      });
    },
    [controller.roomId, controller.socket],
  );

  const canSendRemotePlatformSettings =
    controller.connectionStatus === "connected" && !!controller.roomId;
  const roomSettings = controller.roomSettings;
  const hapticsEnabled = controllerLocalSettings.hapticsEnabled;

  const handleRoomPlatformSettingsPatch = useCallback(
    (patch: PartialRoomPlatformSettingsPatch) => {
      if (canSendRemotePlatformSettings) {
        emitArcadeAction(airJamArcadePlatformActions.updateRoomSettings, patch);
      }
    },
    [canSendRemotePlatformSettings, emitArcadeAction],
  );

  const handleControllerLocalSettingsPatch = useCallback(
    (patch: Partial<ControllerLocalSettingsSnapshot>) => {
      updateSettings(patch);
    },
    [updateSettings],
  );

  const handleArcadePing = useCallback(() => {
    if (hapticsEnabled) {
      triggerLocalHaptic("tap");
    }
    emitArcadeAction(airJamArcadePlatformActions.ping);
  }, [emitArcadeAction, hapticsEnabled]);

  return (
    <ControllerPageLayout
      surfaceMode={surfaceMode}
      routeRoomId={routeRoomId}
      documentFullscreen={documentFullscreen}
      activeUrl={activeUrl}
      controller={controller}
      emitArcadeAction={emitArcadeAction}
      hasControllerCapability={hasControllerCapability}
      controllerOrientation={controllerPresentationOrientation}
      iframeRef={iframeRef}
      controllerIframeSrc={controllerIframeSrc}
      controllerIframePending={controllerIframePending}
      controllerIframeFailed={controllerIframeFailed}
      controllerIframeLoading={controllerIframeLoading}
      controllerIframeRevision={controllerIframeRevision}
      onRetryControllerFrame={retryControllerFrame}
      hostQrVisible={hostQrVisible}
      hapticsEnabled={hapticsEnabled}
      roomPlatformSettings={hasControllerCapability ? roomSettings : null}
      roomPlatformSettingsReadOnly={!canSendRemotePlatformSettings}
      onUpdateRoomPlatformSettings={handleRoomPlatformSettingsPatch}
      controllerLocalSettings={controllerLocalSettings}
      onUpdateControllerLocalSettings={handleControllerLocalSettingsPatch}
      onMove={(vector) => {
        // One command per stick activation; changing direction while held is
        // not a second gesture. Vertical direction retains the grid priority.
        const direction =
          vector.y < -0.5
            ? "up"
            : vector.y > 0.5
              ? "down"
              : vector.x < -0.5
                ? "left"
                : vector.x > 0.5
                  ? "right"
                  : null;
        const wasHeld = navigationHeldRef.current;
        navigationHeldRef.current = direction !== null;
        const surface = useArcadeSurfaceStore.getState();
        if (!direction || wasHeld || surface.kind !== "browser") return;
        emitArcadeAction(airJamArcadePlatformActions.navigate, {
          epoch: surface.epoch,
          direction,
        });
      }}
      onConfirm={() => {
        if (confirmHeldRef.current) return;
        confirmHeldRef.current = true;
        const surface = useArcadeSurfaceStore.getState();
        if (surface.kind !== "browser") return;
        emitArcadeAction(airJamArcadePlatformActions.confirm, {
          epoch: surface.epoch,
        });
      }}
      onConfirmRelease={() => {
        confirmHeldRef.current = false;
      }}
      onPing={handleArcadePing}
    />
  );
}
