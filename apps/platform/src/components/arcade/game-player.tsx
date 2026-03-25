"use client";

import {
  embeddedBridgeForwardShouldClose,
  shouldRejectHostBridgeHandshake,
} from "@/components/arcade/embedded-bridge-surface-guard";
import { cn } from "@/lib/utils";
import {
  type PlayerProfile,
  useVolumeStore,
} from "@air-jam/sdk";
import type {
  AirJamActionRpcPayload,
  ControllerInputEvent,
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerStateMessage,
  HostLeftNotice,
  HostRegistrationAck,
  PlaySoundPayload,
  PlayerUpdatedNotice,
  ServerErrorPayload,
} from "@air-jam/sdk/protocol";
import {
  AIRJAM_HOST_BRIDGE_EVENT,
  createHostBridgeAttachMessage,
  createHostBridgeCloseMessage,
  parseHostBridgeEmitMessage,
  parseHostBridgeRequestMessage,
  type AirJamRealtimeClient,
  type HostBridgeServerEventName,
} from "@air-jam/sdk/arcade/bridge/host";
import type { ArcadeSurfaceRuntimeIdentity } from "@air-jam/sdk/arcade/surface";
import {
  buildArcadeGameIframeSrc,
  getRuntimeUrlOrigin,
} from "@air-jam/sdk/arcade/url";
import {
  createArcadeBridgeInitMessage,
  createArcadeSettingsSyncMessage,
} from "@air-jam/sdk/arcade/bridge/iframe";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GamePlayerGame {
  id: string;
  name: string;
  url: string;
  ownerName?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
}

interface GamePlayerProps {
  game: GamePlayerGame;
  normalizedUrl: string;
  joinToken: string;
  roomId: string;
  joinUrl?: string | null;
  hostSocket: AirJamRealtimeClient;
  players: PlayerProfile[];
  gameState: "paused" | "playing";
  isVisible: boolean;
  /** Carried on host bridge attach for embedded runtime epoch alignment. */
  arcadeSurfaceRuntimeIdentity: ArcadeSurfaceRuntimeIdentity;
  onExit: () => void;
  /** Whether to show the default exit button overlay */
  showExitOverlay?: boolean;
}

/**
 * Renders a game in an iframe with the proper Air Jam arcade protocol params.
 * Used by both the Arcade and Preview systems.
 */
export const GamePlayer = ({
  game,
  normalizedUrl,
  joinToken,
  roomId,
  joinUrl,
  hostSocket,
  players,
  gameState,
  isVisible,
  arcadeSurfaceRuntimeIdentity,
  onExit,
  showExitOverlay = false,
}: GamePlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const settingsBridgePortRef = useRef<MessagePort | null>(null);
  const hostBridgePortRef = useRef<MessagePort | null>(null);
  /** Identity frozen at last host bridge attach; drop forwards if parent surface drifts first. */
  const hostBridgeAttachedIdentityRef =
    useRef<ArcadeSurfaceRuntimeIdentity | null>(null);
  const hostSocketRef = useRef(hostSocket);
  const hostBridgeStateRef = useRef({
    roomId,
    joinToken,
    players,
    gameState,
  });
  const arcadeIdentityRef = useRef(arcadeSurfaceRuntimeIdentity);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    arcadeIdentityRef.current = arcadeSurfaceRuntimeIdentity;
  }, [arcadeSurfaceRuntimeIdentity]);

  // Subscribe to volume settings from the arcade overlay
  const { masterVolume, musicVolume, sfxVolume } = useVolumeStore();

  const iframeSrc = buildArcadeGameIframeSrc({
    normalizedUrl,
    roomId,
    joinToken,
    joinUrl,
    arcadeSurface: arcadeSurfaceRuntimeIdentity,
  });
  const iframeTargetOrigin = getRuntimeUrlOrigin(normalizedUrl);

  const establishBridgeChannel = useCallback(() => {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) {
      return;
    }
    if (!iframeTargetOrigin) {
      console.warn("[GamePlayer] Bridge init blocked: invalid iframe origin", {
        gameId: game.id,
        url: normalizedUrl,
      });
      return;
    }

    const channel = new MessageChannel();

    // Reset previous bridge channel if present.
    try {
      settingsBridgePortRef.current?.close();
    } catch {
      // Ignore close errors
    }

    settingsBridgePortRef.current = channel.port1;
    settingsBridgePortRef.current.start();

    contentWindow.postMessage(
      createArcadeBridgeInitMessage(),
      iframeTargetOrigin,
      [channel.port2],
    );
  }, [game.id, iframeTargetOrigin, normalizedUrl]);

  /**
   * Send current volume settings to the game iframe via postMessage.
   * The SDK's volume store in the game will listen for these messages.
   */
  const sendSettingsToGame = useCallback(() => {
    const payload = createArcadeSettingsSyncMessage({
      masterVolume,
      musicVolume,
      sfxVolume,
    });

    const bridgePort = settingsBridgePortRef.current;
    if (bridgePort) {
      bridgePort.postMessage(payload);
      return;
    }

    if (!iframeTargetOrigin) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage(payload, iframeTargetOrigin);
  }, [masterVolume, musicVolume, sfxVolume, iframeTargetOrigin]);

  // Send settings whenever they change (and iframe is loaded)
  useEffect(() => {
    if (iframeLoaded && isVisible) {
      sendSettingsToGame();
    }
  }, [iframeLoaded, isVisible, sendSettingsToGame]);

  useEffect(() => {
    hostSocketRef.current = hostSocket;
    hostBridgeStateRef.current = {
      roomId,
      joinToken,
      players,
      gameState,
    };
  }, [gameState, hostSocket, joinToken, players, roomId]);

  useEffect(() => {
    return () => {
      try {
        settingsBridgePortRef.current?.close();
      } catch {
        // Ignore close errors
      }
      settingsBridgePortRef.current = null;
      try {
        hostBridgePortRef.current?.postMessage(
          createHostBridgeCloseMessage("game_unloaded"),
        );
        hostBridgePortRef.current?.close();
      } catch {
        // Ignore close errors
      }
      hostBridgePortRef.current = null;
    };
  }, []);

  const closeHostBridge = useCallback((reason?: string) => {
    const currentPort = hostBridgePortRef.current;
    if (!currentPort) {
      return;
    }

    try {
      currentPort.postMessage(createHostBridgeCloseMessage(reason));
    } catch {
      // Port may already be closed by the child iframe.
    }

    currentPort.onmessage = null;
    currentPort.close();
    hostBridgePortRef.current = null;
    hostBridgeAttachedIdentityRef.current = null;
  }, []);

  const attachHostBridgePort = useCallback(
    (port: MessagePort) => {
      closeHostBridge("replaced");
      hostBridgePortRef.current = port;
      hostBridgeAttachedIdentityRef.current = arcadeSurfaceRuntimeIdentity;
      port.start?.();

      port.onmessage = (event) => {
        const message = parseHostBridgeEmitMessage(event.data);
        const socket = hostSocketRef.current;
        if (!message) {
          return;
        }

        socket.emit(message.payload.event, ...(message.payload.args as never[]));
      };

      const state = hostBridgeStateRef.current;
      const socket = hostSocketRef.current;
      const playerNotices: ControllerJoinedNotice[] = state.players.map((player) => ({
        controllerId: player.id,
        nickname: player.label,
        player,
      }));

      port.postMessage(
        createHostBridgeAttachMessage({
          roomId: state.roomId,
          joinToken: state.joinToken,
          connected: socket.connected,
          socketId: socket.id,
          players: playerNotices,
          state: {
            gameState: state.gameState,
          },
          arcadeSurface: arcadeSurfaceRuntimeIdentity,
        }),
      );
    },
    [arcadeSurfaceRuntimeIdentity, closeHostBridge],
  );

  const forwardHostBridgeEvent = useCallback(
    (eventName: HostBridgeServerEventName, ...args: unknown[]) => {
      const currentPort = hostBridgePortRef.current;
      if (!currentPort) {
        return;
      }

      const attached = hostBridgeAttachedIdentityRef.current;
      const active = arcadeIdentityRef.current;
      if (embeddedBridgeForwardShouldClose(attached, active)) {
        closeHostBridge("arcade_surface_changed");
        return;
      }

      currentPort.postMessage(
        {
          type: AIRJAM_HOST_BRIDGE_EVENT,
          payload: {
            event: eventName,
            args,
          },
        },
      );
    },
    [closeHostBridge],
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (iframeTargetOrigin && event.origin !== iframeTargetOrigin) {
        return;
      }

      const request = parseHostBridgeRequestMessage(event.data);
      if (!request) {
        return;
      }

      if (
        request.payload.handshake.runtimeKind !== "arcade-host-iframe" ||
        request.payload.handshake.capabilityFlags.hostBridge !== true
      ) {
        return;
      }

      const port = event.ports[0];
      if (!port) {
        return;
      }

      const state = hostBridgeStateRef.current;
      const socket = hostSocketRef.current;

      if (
        request.payload.roomId !== state.roomId ||
        request.payload.joinToken !== state.joinToken
      ) {
        port.postMessage(
          createHostBridgeCloseMessage("Embedded host bridge session mismatch."),
        );
        port.close();
        return;
      }

      if (
        shouldRejectHostBridgeHandshake(
          arcadeIdentityRef.current,
          request.payload.arcadeSurface,
        )
      ) {
        port.postMessage(
          createHostBridgeCloseMessage(
            "Embedded host bridge handshake rejected: arcade surface mismatch.",
          ),
        );
        port.close();
        return;
      }

      if (!socket.connected) {
        port.postMessage(
          createHostBridgeCloseMessage("Parent host runtime is disconnected."),
        );
        port.close();
        return;
      }

      socket.emit(
        "host:activateEmbeddedGame",
        {
          roomId: state.roomId,
          joinToken: state.joinToken,
        },
        (ack: HostRegistrationAck) => {
          if (!ack.ok) {
            port.postMessage(
              createHostBridgeCloseMessage(
                ack.message ?? "Failed to activate embedded host runtime.",
              ),
            );
            port.close();
            return;
          }

          attachHostBridgePort(port);
        },
      );
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      closeHostBridge("game_unloaded");
    };
  }, [
    attachHostBridgePort,
    closeHostBridge,
    iframeTargetOrigin,
  ]);

  useEffect(() => {
    const handleConnect = () => {
      forwardHostBridgeEvent("connect");
    };
    const handleDisconnect = (reason?: string) => {
      forwardHostBridgeEvent("disconnect", reason);
    };
    const handleControllerJoined = (payload: ControllerJoinedNotice) => {
      forwardHostBridgeEvent("server:controllerJoined", payload);
    };
    const handleControllerLeft = (payload: ControllerLeftNotice) => {
      forwardHostBridgeEvent("server:controllerLeft", payload);
    };
    const handlePlayerUpdated = (payload: PlayerUpdatedNotice) => {
      forwardHostBridgeEvent("server:playerUpdated", payload);
    };
    const handleInput = (payload: ControllerInputEvent) => {
      forwardHostBridgeEvent("server:input", payload);
    };
    const handleError = (payload: ServerErrorPayload) => {
      forwardHostBridgeEvent("server:error", payload);
    };
    const handleState = (payload: ControllerStateMessage) => {
      forwardHostBridgeEvent("server:state", payload);
    };
    const handleHostLeft = (payload: HostLeftNotice) => {
      forwardHostBridgeEvent("server:hostLeft", payload);
    };
    const handlePlaySound = (payload: PlaySoundPayload) => {
      forwardHostBridgeEvent("server:playSound", payload);
    };
    const handleActionRpc = (payload: AirJamActionRpcPayload) => {
      forwardHostBridgeEvent("airjam:action_rpc", payload);
    };
    const handleCloseChild = () => {
      forwardHostBridgeEvent("server:closeChild");
    };

    hostSocket.on("connect", handleConnect);
    hostSocket.on("disconnect", handleDisconnect);
    hostSocket.on("server:controllerJoined", handleControllerJoined);
    hostSocket.on("server:controllerLeft", handleControllerLeft);
    hostSocket.on("server:playerUpdated", handlePlayerUpdated);
    hostSocket.on("server:input", handleInput);
    hostSocket.on("server:error", handleError);
    hostSocket.on("server:state", handleState);
    hostSocket.on("server:hostLeft", handleHostLeft);
    hostSocket.on("server:playSound", handlePlaySound);
    hostSocket.on("airjam:action_rpc", handleActionRpc);
    hostSocket.on("server:closeChild", handleCloseChild);

    return () => {
      hostSocket.off("connect", handleConnect);
      hostSocket.off("disconnect", handleDisconnect);
      hostSocket.off("server:controllerJoined", handleControllerJoined);
      hostSocket.off("server:controllerLeft", handleControllerLeft);
      hostSocket.off("server:playerUpdated", handlePlayerUpdated);
      hostSocket.off("server:input", handleInput);
      hostSocket.off("server:error", handleError);
      hostSocket.off("server:state", handleState);
      hostSocket.off("server:hostLeft", handleHostLeft);
      hostSocket.off("server:playSound", handlePlaySound);
      hostSocket.off("airjam:action_rpc", handleActionRpc);
      hostSocket.off("server:closeChild", handleCloseChild);
    };
  }, [forwardHostBridgeEvent, hostSocket]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 bg-black transition-transform duration-500",
        isVisible ? "translate-y-0" : "translate-y-full",
      )}
    >
      {!iframeSrc && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black p-6 text-center text-white">
          <div>
            <p className="text-lg font-semibold">Invalid Game URL</p>
            <p className="mt-2 text-sm text-zinc-300">
              This game cannot be loaded because its URL is not a valid http(s)
              origin.
            </p>
          </div>
        </div>
      )}
      {iframeSrc && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="h-full w-full border-none bg-black"
          style={{ backgroundColor: "#000000" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
          onLoad={() => {
            console.log("[GamePlayer] Iframe loaded", {
              gameId: game.id,
              src: iframeRef.current?.src,
            });
            establishBridgeChannel();
            setIframeLoaded(true);
            // Send initial settings after a small delay to ensure the game is ready
            setTimeout(sendSettingsToGame, 100);
          }}
          onError={(e) => {
            console.error("[GamePlayer] Iframe error", e);
          }}
        />
      )}

      {/* Default exit overlay (shown on hover) */}
      {showExitOverlay && (
        <div className="absolute top-4 right-4 z-50 opacity-0 transition-opacity hover:opacity-100">
          <button
            onClick={onExit}
            className="rounded bg-red-600/80 px-4 py-2 text-white shadow-lg backdrop-blur hover:bg-red-600"
          >
            Exit Game
          </button>
        </div>
      )}
    </div>
  );
};
