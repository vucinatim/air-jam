"use client";

import { useArcadeSurfaceStore } from "@/components/arcade";
import {
  embeddedBridgeForwardShouldClose,
  shouldRejectControllerBridgeHandshake,
} from "@/components/arcade/embedded-bridge-surface-guard";
import { platformControllerSessionConfig } from "@/lib/airjam-session-config";
import { buildEmbeddedRuntimeTopology } from "@/lib/embedded-runtime-topology";
import { runtimeTopologyToQueryParams } from "@air-jam/runtime-topology";
import type { AirJamControllerApi, ControllerOrientation } from "@air-jam/sdk";
import {
  AIRJAM_CONTROLLER_BRIDGE_EVENT,
  createControllerBridgeAttachMessage,
  createControllerBridgeCloseMessage,
  parseControllerBridgeEmitMessage,
  parseControllerBridgeRequestMessage,
  parseControllerPresentationSyncMessage,
  type ControllerBridgeServerEventName,
} from "@air-jam/sdk/arcade/bridge/controller";
import {
  arcadeSurfaceRuntimeUrlParams,
  type ArcadeSurfaceRuntimeIdentity,
} from "@air-jam/sdk/arcade/surface";
import {
  appendRuntimeQueryParams,
  getRuntimeUrlOrigin,
  normalizeRuntimeUrl,
} from "@air-jam/sdk/arcade/url";
import type {
  AirJamStateSyncPayload,
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerStateMessage,
  ControllerWelcomePayload,
  HostLeftNotice,
  PlayerUpdatedNotice,
  PlaySoundPayload,
  ServerErrorPayload,
  SignalPayload,
} from "@air-jam/sdk/protocol";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useShallow } from "zustand/react/shallow";

interface UseControllerEmbeddedGameFrameOptions {
  controller: AirJamControllerApi;
}

interface ControllerSurfaceOrientationOverride {
  orientation: ControllerOrientation;
  surfaceKey: string;
}

interface ControllerEmbeddedGameFrameState {
  activeUrl: string | null;
  hostQrVisible: boolean;
  controllerPresentationOrientation: "portrait" | "landscape";
  controllerIframeSrc: string | null;
  controllerIframePending: boolean;
  controllerIframeFailed: boolean;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

const arcadeSurfaceKey = (surface: {
  kind: ArcadeSurfaceRuntimeIdentity["kind"];
  epoch: ArcadeSurfaceRuntimeIdentity["epoch"];
  gameId: ArcadeSurfaceRuntimeIdentity["gameId"];
}): string => `${surface.kind}:${surface.epoch}:${surface.gameId ?? ""}`;

export function useControllerEmbeddedGameFrame({
  controller,
}: UseControllerEmbeddedGameFrameOptions): ControllerEmbeddedGameFrameState {
  const arcadeSurface = useArcadeSurfaceStore(
    useShallow((state) => ({
      kind: state.kind,
      controllerUrl: state.controllerUrl,
      epoch: state.epoch,
      gameId: state.gameId,
      overlay: state.overlay,
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

    return normalizeRuntimeUrl(arcadeSurface.controllerUrl);
  }, [
    arcadeSurface.controllerUrl,
    arcadeSurface.kind,
    controller.connectionStatus,
  ]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgePortRef = useRef<MessagePort | null>(null);
  const pendingBridgeTeardownRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const controllerIframeHandshakeDeadlineRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [bridgeListenerReady, setBridgeListenerReady] = useState(false);
  const [controllerIframeFailed, setControllerIframeFailed] = useState(false);
  const [
    controllerSurfaceOrientationOverride,
    setControllerSurfaceOrientationOverride,
  ] = useState<ControllerSurfaceOrientationOverride | null>(null);
  const bridgeAttachedIdentityRef = useRef<ArcadeSurfaceRuntimeIdentity | null>(
    null,
  );
  const arcadeSurfaceRef = useRef(arcadeSurface);
  const controllerSocketRef = useRef(controller.socket);
  const controllerSessionRef = useRef({
    roomId: controller.roomId,
    controllerId: controller.controllerId,
    runtimeState: controller.runtimeState,
    controllerOrientation: controller.controllerOrientation,
    stateMessage: controller.stateMessage,
    players: controller.players,
  });

  arcadeSurfaceRef.current = arcadeSurface;

  const activeArcadeSurfaceKey =
    activeUrl && arcadeSurface.kind === "game"
      ? arcadeSurfaceKey(arcadeSurface)
      : null;
  const activeControllerSurfaceOrientation =
    activeArcadeSurfaceKey &&
    controllerSurfaceOrientationOverride?.surfaceKey === activeArcadeSurfaceKey
      ? controllerSurfaceOrientationOverride.orientation
      : null;
  const controllerPresentationOrientation =
    activeUrl && arcadeSurface.kind === "game"
      ? (activeControllerSurfaceOrientation ?? controller.controllerOrientation)
      : "portrait";

  const rawControllerIframeSrc = useMemo(() => {
    if (!activeUrl || !controller.controllerId || !controller.roomId) {
      return null;
    }

    return appendRuntimeQueryParams(activeUrl, {
      aj_controller_id: controller.controllerId,
      aj_room: controller.roomId,
      ...runtimeTopologyToQueryParams(
        buildEmbeddedRuntimeTopology({
          runtimeMode: platformControllerSessionConfig.topology.runtimeMode as
            | "arcade-live"
            | "arcade-built",
          surfaceRole: "controller",
          runtimeUrl: activeUrl,
          parentTopology: platformControllerSessionConfig.topology,
        }),
      ),
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
    controller.roomId,
  ]);

  const controllerIframeSrc =
    bridgeListenerReady && rawControllerIframeSrc
      ? rawControllerIframeSrc
      : null;
  const controllerIframePending =
    Boolean(rawControllerIframeSrc) && !bridgeListenerReady;

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

  const clearControllerIframeHandshakeDeadline = useCallback(() => {
    if (controllerIframeHandshakeDeadlineRef.current) {
      clearTimeout(controllerIframeHandshakeDeadlineRef.current);
      controllerIframeHandshakeDeadlineRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (pendingBridgeTeardownRef.current) {
      clearTimeout(pendingBridgeTeardownRef.current);
      pendingBridgeTeardownRef.current = null;
    }

    return () => {
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
      runtimeState: controller.runtimeState,
      controllerOrientation: controller.controllerOrientation,
      stateMessage: controller.stateMessage,
      players: controller.players,
    };
  }, [
    controller.controllerId,
    controller.controllerOrientation,
    controller.players,
    controller.roomId,
    controller.runtimeState,
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
        (candidate: { id: string }) => candidate.id === session.controllerId,
      );
      const socket = controllerSocketRef.current;

      port.postMessage(
        createControllerBridgeAttachMessage({
          roomId: session.roomId!,
          controllerId: session.controllerId!,
          connected: socket?.connected ?? false,
          socketId: socket?.id,
          player,
          players: session.players,
          state: {
            runtimeState: session.runtimeState,
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
    [
      arcadeSurface.epoch,
      arcadeSurface.gameId,
      arcadeSurface.kind,
      closeBridge,
    ],
  );

  useEffect(() => {
    if (!activeUrl) {
      closeBridge("game_unloaded");
    }
  }, [activeUrl, closeBridge]);

  useEffect(() => {
    if (!activeUrl) {
      setBridgeListenerReady(false);
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const presentation = parseControllerPresentationSyncMessage(event.data);
      if (presentation) {
        const expectedOrigin = getRuntimeUrlOrigin(activeUrl);
        if (expectedOrigin && event.origin !== expectedOrigin) {
          return;
        }

        const surface = arcadeSurfaceRef.current;
        if (
          shouldRejectControllerBridgeHandshake(
            surface,
            presentation.payload.arcadeSurface,
          )
        ) {
          return;
        }

        setControllerSurfaceOrientationOverride({
          orientation: presentation.payload.orientation,
          surfaceKey: arcadeSurfaceKey(presentation.payload.arcadeSurface),
        });
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
        console.warn("[airjam] controller bridge session mismatch", {
          expectedRoomId: session.roomId,
          expectedControllerId: session.controllerId,
          receivedRoomId: request.payload.roomId,
          receivedControllerId: request.payload.controllerId,
        });
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
        shouldRejectControllerBridgeHandshake(
          surface,
          request.payload.arcadeSurface,
        )
      ) {
        console.warn("[airjam] controller bridge surface mismatch", {
          shellSurface: surface,
          requestSurface: request.payload.arcadeSurface,
        });
        port.postMessage(
          createControllerBridgeCloseMessage(
            "Embedded controller bridge handshake rejected: arcade surface mismatch.",
          ),
        );
        port.close();
        return;
      }

      console.info("[airjam] controller bridge attach", {
        roomId: session.roomId,
        controllerId: session.controllerId,
        connected: controllerSocketRef.current?.connected ?? false,
        socketId: controllerSocketRef.current?.id,
        playerCount: session.players.length,
        gameId: surface.gameId,
        epoch: surface.epoch,
      });
      attachBridgePort(port);
      clearControllerIframeHandshakeDeadline();
      setControllerIframeFailed(false);
    };

    window.addEventListener("message", handleMessage);
    setBridgeListenerReady(true);
    return () => {
      setBridgeListenerReady(false);
      window.removeEventListener("message", handleMessage);
    };
  }, [activeUrl, attachBridgePort, clearControllerIframeHandshakeDeadline]);

  useEffect(() => {
    clearControllerIframeHandshakeDeadline();

    if (!activeUrl || !controllerIframeSrc) {
      setControllerIframeFailed(false);
      return;
    }

    setControllerIframeFailed(false);
    controllerIframeHandshakeDeadlineRef.current = setTimeout(() => {
      if (bridgePortRef.current) {
        return;
      }

      setControllerIframeFailed(true);
      console.warn(
        "Embedded controller iframe did not attach to the platform bridge.",
        {
          controllerIframeSrc,
          likelyCause:
            "controller game surface did not finish loading through the local Arcade test route",
        },
      );
    }, 4000);

    return () => {
      clearControllerIframeHandshakeDeadline();
    };
  }, [activeUrl, clearControllerIframeHandshakeDeadline, controllerIframeSrc]);

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
    const handleControllerJoined = (payload: ControllerJoinedNotice) => {
      forwardBridgeEvent("server:controllerJoined", payload);
    };
    const handleControllerLeft = (payload: ControllerLeftNotice) => {
      forwardBridgeEvent("server:controllerLeft", payload);
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
    controller.socket.on("server:controllerJoined", handleControllerJoined);
    controller.socket.on("server:controllerLeft", handleControllerLeft);
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
      controller.socket?.off("server:controllerJoined", handleControllerJoined);
      controller.socket?.off("server:controllerLeft", handleControllerLeft);
      controller.socket?.off("server:state", handleState);
      controller.socket?.off("server:hostLeft", handleHostLeft);
      controller.socket?.off("server:error", handleError);
      controller.socket?.off("server:signal", handleSignal);
      controller.socket?.off("server:playSound", handlePlaySound);
      controller.socket?.off("airjam:state_sync", handleStateSync);
      controller.socket?.off("server:playerUpdated", handlePlayerUpdated);
    };
  }, [closeBridge, controller.socket, forwardBridgeEvent]);

  return {
    activeUrl,
    hostQrVisible,
    controllerPresentationOrientation,
    controllerIframeSrc,
    controllerIframePending,
    controllerIframeFailed,
    iframeRef,
  };
}
