"use client";

import { useArcadeSurfaceStore } from "@/components/arcade";
import { useArcadePlatformSettingsStore } from "@/components/arcade/arcade-platform-settings-store";
import {
  embeddedBridgeForwardShouldClose,
  shouldRejectControllerBridgeHandshake,
} from "@/components/arcade/embedded-bridge-surface-guard";
import { ControllerMenuSheet } from "@/components/controller-menu-sheet";
import { RemoteDPad } from "@/components/remote-d-pad";
import { platformControllerSessionConfig } from "@/lib/airjam-session-config";
import {
  getControllerLocalProfileClientSnapshot,
  getControllerLocalProfileServerSnapshot,
  subscribeControllerLocalProfile,
} from "@/lib/controller-local-profile";
import { useDocumentFullscreen } from "@/lib/use-document-fullscreen";
import { cn } from "@/lib/utils";
import {
  AirJamControllerRuntime,
  PlatformSettingsRuntime,
  useInheritedPlatformSettings,
  useAirJamController,
  useControllerTick,
  useInputWriter,
  type PlatformSettingsSnapshot,
} from "@air-jam/sdk";
import type {
  AirJamStateSyncPayload,
  ControllerStateMessage,
  ControllerWelcomePayload,
  HostLeftNotice,
  PlayerUpdatedNotice,
  PlaySoundPayload,
  ServerErrorPayload,
  SignalPayload,
} from "@air-jam/sdk/protocol";
import { airJamArcadePlatformActions } from "@air-jam/sdk/protocol";
import {
  AIRJAM_CONTROLLER_BRIDGE_EVENT,
  type ControllerBridgeServerEventName,
  createControllerBridgeAttachMessage,
  createControllerBridgeCloseMessage,
  parseControllerBridgeEmitMessage,
  parseControllerBridgeRequestMessage,
} from "@air-jam/sdk/arcade/bridge/controller";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  arcadeSurfaceRuntimeUrlParams,
  type ArcadeSurfaceRuntimeIdentity,
} from "@air-jam/sdk/arcade/surface";
import {
  appendRuntimeQueryParams,
  normalizeRuntimeUrl,
} from "@air-jam/sdk/arcade/url";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import { CornerDownLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  type CSSProperties,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { useShallow } from "zustand/react/shallow";

function ControllerPageContent({ routeRoomId }: { routeRoomId: string | null }) {
  const documentFullscreen = useDocumentFullscreen();
  const localProfile = useSyncExternalStore(
    subscribeControllerLocalProfile,
    getControllerLocalProfileClientSnapshot,
    getControllerLocalProfileServerSnapshot,
  );
  const controller = useAirJamController();
  const localPlatformSettings = useInheritedPlatformSettings();
  const sharedPlatformSettings = useArcadePlatformSettingsStore(
    (state) => state.settings,
  );
  const writeInput = useInputWriter();

  const arcadeSurface = useArcadeSurfaceStore(
    useShallow((s) => ({
      kind: s.kind,
      controllerUrl: s.controllerUrl,
      epoch: s.epoch,
      gameId: s.gameId,
      overlay: s.overlay,
    })),
  );

  const hostQrVisible = arcadeSurface.overlay === "qr";

  const activeUrl = useMemo(() => {
    if (
      controller.connectionStatus !== "connected" ||
      arcadeSurface.kind !== "game" ||
      !arcadeSurface.controllerUrl
    ) {
      return null;
    }
    const normalized = normalizeRuntimeUrl(arcadeSurface.controllerUrl);
    if (!normalized) {
      return null;
    }
    return normalized;
  }, [
    controller.connectionStatus,
    arcadeSurface.kind,
    arcadeSurface.controllerUrl,
  ]);

  const vectorRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);
  const lastLoopFailLogRef = useRef(0);
  const arcadeSurfaceRef = useRef(arcadeSurface);
  arcadeSurfaceRef.current = arcadeSurface;

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

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgePortRef = useRef<MessagePort | null>(null);
  const pendingBridgeTeardownRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Snapshot of `ArcadeSurfaceRuntimeIdentity` at last successful bridge attach; used to drop stale forwards after a surface switch. */
  const bridgeAttachedIdentityRef = useRef<ArcadeSurfaceRuntimeIdentity | null>(
    null,
  );
  const controllerSocketRef = useRef(controller.socket);
  const controllerSessionRef = useRef({
    roomId: controller.roomId,
    controllerId: controller.controllerId,
    gameState: controller.gameState,
    controllerOrientation: controller.controllerOrientation,
    stateMessage: controller.stateMessage,
    players: controller.players,
  });
  /** Outer chrome: SDK `controllerOrientation` (host `server:state`), not arcade surface launch `orientation`. */
  const controllerPresentationOrientation =
    activeUrl && arcadeSurface.kind === "game"
      ? controller.controllerOrientation
      : "portrait";
  const controllerChromeInsetStyle: CSSProperties | undefined =
    !documentFullscreen
      ? activeUrl && controllerPresentationOrientation === "landscape"
        ? { paddingRight: "env(safe-area-inset-right)" }
        : { paddingTop: "env(safe-area-inset-top)" }
      : undefined;

  const controllerIframeSrc = useMemo(() => {
    if (!activeUrl || !controller.controllerId || !controller.roomId) {
      return null;
    }

    const labelForEmbed = controller.selfPlayer?.label || localProfile.label;
    const avatarIdForEmbed =
      controller.selfPlayer?.avatarId || localProfile.avatarId;

    return appendRuntimeQueryParams(activeUrl, {
      aj_controller_id: controller.controllerId,
      aj_room: controller.roomId,
      ...(labelForEmbed ? { aj_player_label: labelForEmbed } : {}),
      ...(avatarIdForEmbed ? { aj_player_avatar: avatarIdForEmbed } : {}),
      ...(arcadeSurface.kind === "game"
        ? arcadeSurfaceRuntimeUrlParams({
            epoch: arcadeSurface.epoch,
            kind: arcadeSurface.kind,
            gameId: arcadeSurface.gameId,
          })
        : {}),
    });
  }, [
    activeUrl,
    arcadeSurface.epoch,
    arcadeSurface.gameId,
    arcadeSurface.kind,
    controller.controllerId,
    localProfile.avatarId,
    localProfile.label,
    controller.selfPlayer,
    controller.roomId,
  ]);

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
    [controller.socket, controller.roomId],
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

  const closeBridge = useCallback((reason?: string) => {
    const currentPort = bridgePortRef.current;
    if (!currentPort) {
      return;
    }

    try {
      currentPort.postMessage(createControllerBridgeCloseMessage(reason));
    } catch {
      // Port may already be closed by the child iframe.
    }

    currentPort.onmessage = null;
    currentPort.close();
    bridgePortRef.current = null;
    bridgeAttachedIdentityRef.current = null;
  }, []);

  useEffect(() => {
    if (pendingBridgeTeardownRef.current) {
      clearTimeout(pendingBridgeTeardownRef.current);
      pendingBridgeTeardownRef.current = null;
    }

    return () => {
      // Defer teardown so React dev effect replay does not permanently sever a live iframe bridge.
      pendingBridgeTeardownRef.current = setTimeout(() => {
        closeBridge("game_unloaded");
        pendingBridgeTeardownRef.current = null;
      }, 0);
    };
  }, [closeBridge]);

  useEffect(() => {
    controllerSocketRef.current = controller.socket;
    controllerSessionRef.current = {
      roomId: controller.roomId,
      controllerId: controller.controllerId,
      gameState: controller.gameState,
      controllerOrientation: controller.controllerOrientation,
      stateMessage: controller.stateMessage,
      players: controller.players,
    };
  }, [
    controller.controllerId,
    controller.controllerOrientation,
    controller.gameState,
    controller.players,
    controller.roomId,
    controller.socket,
    controller.stateMessage,
  ]);

  const forwardBridgeEvent = useCallback(
    (event: ControllerBridgeServerEventName, ...args: unknown[]) => {
      const currentPort = bridgePortRef.current;
      if (!currentPort) {
        return;
      }

      const attached = bridgeAttachedIdentityRef.current;
      const surface = arcadeSurfaceRef.current;
      const activeIdentity: ArcadeSurfaceRuntimeIdentity = {
        epoch: surface.epoch,
        kind: surface.kind,
        gameId: surface.gameId,
      };
      if (embeddedBridgeForwardShouldClose(attached, activeIdentity)) {
        closeBridge("arcade_surface_changed");
        return;
      }

      currentPort.postMessage({
        type: AIRJAM_CONTROLLER_BRIDGE_EVENT,
        payload: {
          event,
          args,
        },
      });
    },
    [closeBridge],
  );

  const attachBridgePort = useCallback(
    (port: MessagePort) => {
      closeBridge("replaced");
      bridgePortRef.current = port;
      bridgeAttachedIdentityRef.current =
        arcadeSurface.kind === "game"
          ? {
              epoch: arcadeSurface.epoch,
              kind: arcadeSurface.kind,
              gameId: arcadeSurface.gameId,
            }
          : null;
      port.start?.();

      port.onmessage = (event) => {
        const message = parseControllerBridgeEmitMessage(event.data);
        const socket = controllerSocketRef.current;
        const session = controllerSessionRef.current;
        if (!message || !socket || !session.roomId) {
          return;
        }

        socket.emit(
          message.payload.event,
          ...(message.payload.args as never[]),
        );
      };

      const session = controllerSessionRef.current;
      const player = session.players.find(
        (candidate) => candidate.id === session.controllerId,
      );
      const socket = controllerSocketRef.current;

      port.postMessage(
        createControllerBridgeAttachMessage({
          roomId: session.roomId!,
          controllerId: session.controllerId!,
          connected: socket?.connected ?? false,
          socketId: socket?.id,
          player,
          state: {
            gameState: session.gameState,
            orientation: session.controllerOrientation,
            message: session.stateMessage,
          },
          arcadeSurface: {
            epoch: arcadeSurface.epoch,
            kind: arcadeSurface.kind,
            gameId: arcadeSurface.gameId,
          },
        }),
      );
    },
    [arcadeSurface.epoch, arcadeSurface.gameId, arcadeSurface.kind, closeBridge],
  );

  useEffect(() => {
    vectorRef.current = { x: 0, y: 0 };
    actionRef.current = false;
    if (!activeUrl) {
      closeBridge("game_unloaded");
    }
  }, [activeUrl, closeBridge]);

  useEffect(() => {
    if (!activeUrl) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const request = parseControllerBridgeRequestMessage(event.data);
      if (!request) {
        return;
      }

      if (
        request.payload.handshake.runtimeKind !== "arcade-controller-iframe" ||
        request.payload.handshake.capabilityFlags.controllerBridge !== true
      ) {
        return;
      }

      const port = event.ports[0];
      if (!port) {
        return;
      }

      const session = controllerSessionRef.current;

      if (
        !session.roomId ||
        !session.controllerId ||
        request.payload.roomId !== session.roomId ||
        request.payload.controllerId !== session.controllerId
      ) {
        port.postMessage(
          createControllerBridgeCloseMessage(
            "Embedded controller bridge session mismatch.",
          ),
        );
        port.close();
        return;
      }

      const surface = arcadeSurfaceRef.current;
      if (
        shouldRejectControllerBridgeHandshake(surface, request.payload.arcadeSurface)
      ) {
        port.postMessage(
          createControllerBridgeCloseMessage(
            "Embedded controller bridge handshake rejected: arcade surface mismatch.",
          ),
        );
        port.close();
        return;
      }

      attachBridgePort(port);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [activeUrl, attachBridgePort, closeBridge]);

  useEffect(() => {
    if (!controller.socket) {
      closeBridge("controller_socket_missing");
      return;
    }

    const handleConnect = () => {
      forwardBridgeEvent("connect");
    };
    const handleDisconnect = (reason?: string) => {
      forwardBridgeEvent("disconnect", reason);
    };
    const handleWelcome = (payload: ControllerWelcomePayload) => {
      forwardBridgeEvent("server:welcome", payload);
    };
    const handleState = (payload: ControllerStateMessage) => {
      forwardBridgeEvent("server:state", payload);
    };
    const handleHostLeft = (payload: HostLeftNotice) => {
      forwardBridgeEvent("server:hostLeft", payload);
    };
    const handleError = (payload: ServerErrorPayload) => {
      forwardBridgeEvent("server:error", payload);
    };
    const handleSignal = (payload: SignalPayload) => {
      forwardBridgeEvent("server:signal", payload);
    };
    const handlePlaySound = (payload: PlaySoundPayload) => {
      forwardBridgeEvent("server:playSound", payload);
    };
    const handleStateSync = (payload: AirJamStateSyncPayload) => {
      forwardBridgeEvent("airjam:state_sync", payload);
    };
    const handlePlayerUpdated = (payload: PlayerUpdatedNotice) => {
      forwardBridgeEvent("server:playerUpdated", payload);
    };

    controller.socket.on("connect", handleConnect);
    controller.socket.on("disconnect", handleDisconnect);
    controller.socket.on("server:welcome", handleWelcome);
    controller.socket.on("server:state", handleState);
    controller.socket.on("server:hostLeft", handleHostLeft);
    controller.socket.on("server:error", handleError);
    controller.socket.on("server:signal", handleSignal);
    controller.socket.on("server:playSound", handlePlaySound);
    controller.socket.on("airjam:state_sync", handleStateSync);
    controller.socket.on("server:playerUpdated", handlePlayerUpdated);

    return () => {
      controller.socket?.off("connect", handleConnect);
      controller.socket?.off("disconnect", handleDisconnect);
      controller.socket?.off("server:welcome", handleWelcome);
      controller.socket?.off("server:state", handleState);
      controller.socket?.off("server:hostLeft", handleHostLeft);
      controller.socket?.off("server:error", handleError);
      controller.socket?.off("server:signal", handleSignal);
      controller.socket?.off("server:playSound", handlePlaySound);
      controller.socket?.off("airjam:state_sync", handleStateSync);
      controller.socket?.off("server:playerUpdated", handlePlayerUpdated);
    };
  }, [closeBridge, controller.socket, forwardBridgeEvent]);

  const layout = (
    <div
      className={cn(
        "text-foreground relative flex h-full min-h-0 w-full touch-none flex-col overflow-hidden bg-black select-none",
        accessibility.highContrast && "contrast-125",
      )}
    >
      <ControllerMenuSheet
        routeRoomId={routeRoomId}
        activeUrl={activeUrl}
        controller={controller}
        emitArcadeAction={emitArcadeAction}
        controllerOrientation={controllerPresentationOrientation}
        documentFullscreen={documentFullscreen}
        hostQrVisible={hostQrVisible}
        hapticsEnabled={feedback.hapticsEnabled}
        reducedMotion={accessibility.reducedMotion}
        highContrast={accessibility.highContrast}
        sharedPlatformSettings={
          usesRemotePlatformSettings ? sharedPlatformSettings : null
        }
        onUpdateSharedPlatformSettings={handleRemotePlatformSettingsPatch}
      />

      <main
        className={cn(
          "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden sm:p-4",
        )}
        style={controllerChromeInsetStyle}
      >
        {activeUrl && (
          <div
            className={cn(
              "bg-background absolute inset-0 z-20",
            )}
            style={controllerChromeInsetStyle}
          >
            {controllerIframeSrc ? (
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
          </div>
        )}

        {!activeUrl && (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-8 px-6 pt-24 pb-12">
            <div className="text-center opacity-30">
              <h1 className="text-4xl font-black tracking-tighter uppercase select-none">
                Air Jam
              </h1>
              <p className="text-primary text-2xl font-black tracking-wider uppercase">
                Arcade
              </p>
            </div>

            <div className="flex flex-1 items-center justify-center">
              <RemoteDPad
                onMove={(vector) => {
                  vectorRef.current = vector;
                }}
                onConfirm={() => {
                  actionRef.current = true;
                }}
                onConfirmRelease={() => {
                  actionRef.current = false;
                }}
                hapticsEnabled={feedback.hapticsEnabled}
              />
            </div>

            <div className="text-muted-foreground flex flex-col items-center gap-2 text-center text-sm opacity-50">
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
        )}
      </main>
    </div>
  );

  return (
    <div className="dark">
      {!activeUrl ? (
        <ForcedOrientationShell
          desired="portrait"
          contentClassName="h-full w-full bg-black"
        >
          {layout}
        </ForcedOrientationShell>
      ) : (
        <div className="relative flex h-dvh w-dvw flex-col bg-black">
          {layout}
        </div>
      )}
    </div>
  );
}

function ControllerPageInner({ routeRoomId }: { routeRoomId: string | null }) {
  const localProfile = useSyncExternalStore(
    subscribeControllerLocalProfile,
    getControllerLocalProfileClientSnapshot,
    getControllerLocalProfileServerSnapshot,
  );

  return (
    <PlatformSettingsRuntime persistence="local">
      <AirJamControllerRuntime
        {...platformControllerSessionConfig}
        roomId={routeRoomId ?? undefined}
        nickname={localProfile.label}
        avatarId={localProfile.avatarId}
      >
        <ControllerPageContent routeRoomId={routeRoomId} />
      </AirJamControllerRuntime>
    </PlatformSettingsRuntime>
  );
}

function ControllerRoomKeyedInner() {
  const searchParams = useSearchParams();
  const roomKey = searchParams.get("room");
  const routeRoomId = useMemo(() => {
    if (!roomKey) {
      return null;
    }

    const normalized = roomKey
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return normalized || null;
  }, [roomKey]);

  return (
    <ControllerPageInner key={routeRoomId ?? ""} routeRoomId={routeRoomId} />
  );
}

export default function ControllerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-black text-white">
          Loading…
        </div>
      }
    >
      <ControllerRoomKeyedInner />
    </Suspense>
  );
}
