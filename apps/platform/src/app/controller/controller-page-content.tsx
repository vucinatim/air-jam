"use client";

import { useArcadePlatformSettingsStore } from "@/components/arcade/arcade-platform-settings-store";
import {
  getControllerLocalProfileClientSnapshot,
  writeControllerLocalProfile,
} from "@/lib/controller-local-profile";
import { triggerLocalHaptic } from "@/lib/local-haptics";
import { useDocumentFullscreen } from "@/lib/use-document-fullscreen";
import {
  useAirJamController,
  useControllerTick,
  useInheritedPlatformSettings,
  useInputWriter,
  type PlatformSettingsSnapshot,
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
  const localPlatformSettings = useInheritedPlatformSettings();
  const sharedPlatformSettings = useArcadePlatformSettingsStore(
    (state) => state.settings,
  );
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
    (actionName: string, payload?: Record<string, unknown>) => {
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

  const usesRemotePlatformSettings =
    controller.connectionStatus === "connected" && !!controller.roomId;
  const effectivePlatformSettings = usesRemotePlatformSettings
    ? sharedPlatformSettings
    : localPlatformSettings;
  const accessibility = effectivePlatformSettings.accessibility;
  const feedback = effectivePlatformSettings.feedback;

  const handleRemotePlatformSettingsPatch = useCallback(
    (patch: {
      audio?: Partial<PlatformSettingsSnapshot["audio"]>;
      accessibility?: Partial<PlatformSettingsSnapshot["accessibility"]>;
      feedback?: Partial<PlatformSettingsSnapshot["feedback"]>;
    }) => {
      emitArcadeAction(
        airJamArcadePlatformActions.updatePlatformSettings,
        patch,
      );
    },
    [emitArcadeAction],
  );

  const handleArcadePing = useCallback(() => {
    if (feedback.hapticsEnabled) {
      triggerLocalHaptic("tap");
    }
    emitArcadeAction(airJamArcadePlatformActions.ping);
  }, [emitArcadeAction, feedback.hapticsEnabled]);

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
      hapticsEnabled={feedback.hapticsEnabled}
      reducedMotion={accessibility.reducedMotion}
      highContrast={accessibility.highContrast}
      sharedPlatformSettings={
        usesRemotePlatformSettings ? sharedPlatformSettings : null
      }
      onUpdateSharedPlatformSettings={handleRemotePlatformSettingsPatch}
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
