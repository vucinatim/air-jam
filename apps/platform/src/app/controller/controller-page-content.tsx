"use client";

import {
  getControllerLocalProfileClientSnapshot,
  writeControllerLocalProfile,
} from "@/lib/controller-local-profile";
import { triggerLocalHaptic } from "@/lib/local-haptics";
import { useDocumentFullscreen } from "@/lib/use-document-fullscreen";
import {
  type PartialRoomPlatformSettingsPatch,
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN } from "@air-jam/sdk/arcade/surface";
import { airJamArcadePlatformActions } from "@air-jam/sdk/protocol";
import { useCallback, useEffect, useRef } from "react";
import {
  useControllerLocalSettings,
  type ControllerLocalSettingsSnapshot,
} from "@/lib/controller-local-settings";
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
  const writeInput = useInputWriter();

  const {
    activeUrl,
    hostQrVisible,
    controllerPresentationOrientation,
    controllerIframeSrc,
    controllerIframePending,
    controllerIframeFailed,
    iframeRef,
  } = useControllerEmbeddedGameFrame({
    controller,
  });

  const vectorRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);
  const lastLoopFailLogRef = useRef(0);
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

  useControllerTick(
    () => {
      const inputResult = writeInput({
        vector: vectorRef.current,
        action: actionRef.current,
        timestamp: Date.now(),
      });

      const now = Date.now();
      if (
        !inputResult &&
        (!lastLoopFailLogRef.current || now - lastLoopFailLogRef.current > 1000)
      ) {
        lastLoopFailLogRef.current = now;
      }
    },
    {
      enabled: controller.connectionStatus === "connected" && !activeUrl,
      intervalMs: 16,
    },
  );

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
        emitArcadeAction(
          airJamArcadePlatformActions.updateRoomSettings,
          patch,
        );
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
      hostQrVisible={hostQrVisible}
      hapticsEnabled={hapticsEnabled}
      roomPlatformSettings={hasControllerCapability ? roomSettings : null}
      roomPlatformSettingsReadOnly={!canSendRemotePlatformSettings}
      onUpdateRoomPlatformSettings={handleRoomPlatformSettingsPatch}
      controllerLocalSettings={controllerLocalSettings}
      onUpdateControllerLocalSettings={handleControllerLocalSettingsPatch}
      onMove={(vector) => {
        vectorRef.current = vector;
      }}
      onConfirm={() => {
        actionRef.current = true;
      }}
      onConfirmRelease={() => {
        actionRef.current = false;
      }}
      onPing={handleArcadePing}
    />
  );
}
