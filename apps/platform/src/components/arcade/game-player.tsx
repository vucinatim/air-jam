"use client";

import {
  embeddedBridgeForwardShouldClose,
  shouldRejectHostBridgeHandshake,
} from "@/components/arcade/embedded-bridge-surface-guard";
import { buildEmbeddedRuntimeTopology } from "@/lib/embedded-runtime-topology";
import { cn } from "@/lib/utils";
import type { ResolvedAirJamRuntimeTopology } from "@air-jam/runtime-topology";
import { useInheritedPlatformSettings, type PlayerProfile } from "@air-jam/sdk";
import {
  AIRJAM_HOST_BRIDGE_EVENT,
  createHostBridgeAttachMessage,
  createHostBridgeCloseMessage,
  parseHostBridgeEmitMessage,
  parseHostBridgeRequestMessage,
  type AirJamRealtimeClient,
  type HostBridgeServerEventName,
} from "@air-jam/sdk/arcade/bridge/host";
import {
  AIRJAM_DEV_LOG_SINK_FAILURE,
  AIRJAM_DEV_PROVIDER_MOUNTED,
  createParentPlatformSettingsBridge,
  emitAirJamDevRuntimeEvent,
} from "@air-jam/sdk/arcade/bridge/iframe";
import type { ArcadeSurfaceRuntimeIdentity } from "@air-jam/sdk/arcade/surface";
import {
  buildArcadeGameIframeSrc,
  getRuntimeUrlOrigin,
} from "@air-jam/sdk/arcade/url";
import type {
  AirJamActionRpcPayload,
  ChildHostCapability,
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
import { AIRJAM_DEV_LOG_EVENTS } from "@air-jam/sdk/protocol";
import { useCallback, useEffect, useRef } from "react";

export interface GamePlayerGame {
  id: string;
  name: string;
  url: string;
  controllerUrl: string;
  ownerName?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  catalogSource?: "public_arcade" | "local_dev";
  catalogBadgeLabel?: string | null;
  sourceUrl?: string | null;
  templateId?: string | null;
}

interface GamePlayerProps {
  game: GamePlayerGame;
  normalizedUrl: string;
  launchCapability: ChildHostCapability;
  roomId: string;
  joinUrl?: string | null;
  hostSocket: AirJamRealtimeClient;
  players: PlayerProfile[];
  runtimeState: "paused" | "playing";
  isVisible: boolean;
  /** Carried on host bridge attach for embedded runtime epoch alignment. */
  arcadeSurfaceRuntimeIdentity: ArcadeSurfaceRuntimeIdentity;
  onExit: () => void;
  /** Whether to show the default exit button overlay */
  showExitOverlay?: boolean;
  reducedMotion?: boolean;
  parentTopology: ResolvedAirJamRuntimeTopology;
}

/**
 * Renders a game in an iframe with the proper Air Jam arcade protocol params.
 * Used by both the Arcade and Preview systems.
 */
export const GamePlayer = ({
  game,
  normalizedUrl,
  launchCapability,
  roomId,
  joinUrl,
  hostSocket,
  players,
  runtimeState,
  isVisible,
  arcadeSurfaceRuntimeIdentity,
  onExit,
  showExitOverlay = false,
  reducedMotion = false,
  parentTopology,
}: GamePlayerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hostBridgePortRef = useRef<MessagePort | null>(null);
  const pendingBridgeTeardownRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Subscribe to the platform-owned shared settings snapshot.
  const platformSettings = useInheritedPlatformSettings();
  const settingsBridgeRef = useRef(
    createParentPlatformSettingsBridge({
      onEvent: (event, payload) => {
        if (event === "bridgeAttached") {
          const data = payload as {
            state: "unbound" | "waiting_ready" | "ready";
          };
          emitAirJamDevRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
            message: "Arcade host attached embedded platform settings bridge",
            level: "info",
            role: "host",
            roomId,
            runtimeEpoch: arcadeIdentityRef.current.epoch,
            runtimeKind: "arcade-host-runtime",
            data: {
              gameId: game.id,
              state: data.state,
            },
          });
          return;
        }

        if (event === "settingsReady") {
          const data = payload as {
            state: "unbound" | "waiting_ready" | "ready";
          };
          emitAirJamDevRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
            message: "Arcade host received embedded settings-ready request",
            level: "info",
            role: "host",
            roomId,
            runtimeEpoch: arcadeIdentityRef.current.epoch,
            runtimeKind: "arcade-host-runtime",
            data: {
              gameId: game.id,
              state: data.state,
            },
          });
          return;
        }

        if (event !== "snapshotFlushed") {
          return;
        }

        const data = payload as {
          phase: "initial" | "update";
          transports: Array<"bridge_port" | "window_postmessage">;
          settings: typeof platformSettings;
        };

        emitAirJamDevRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
          message:
            data.phase === "initial"
              ? "Arcade host flushed initial platform settings snapshot to embedded game"
              : "Arcade host flushed updated platform settings snapshot to embedded game",
          level: "info",
          role: "host",
          roomId,
          runtimeEpoch: arcadeIdentityRef.current.epoch,
          runtimeKind: "arcade-host-runtime",
          data: {
            gameId: game.id,
            phase: data.phase,
            state: settingsBridgeRef.current.getState(),
            transports: data.transports,
            settings: data.settings,
          },
        });
      },
    }),
  );
  /** Identity frozen at last host bridge attach; drop forwards if parent surface drifts first. */
  const hostBridgeAttachedIdentityRef =
    useRef<ArcadeSurfaceRuntimeIdentity | null>(null);
  const arcadeIdentityRef = useRef(arcadeSurfaceRuntimeIdentity);
  const settingsBridgeAttachKeyRef = useRef<string | null>(null);

  useEffect(() => {
    arcadeIdentityRef.current = arcadeSurfaceRuntimeIdentity;
  }, [arcadeSurfaceRuntimeIdentity]);

  const iframeSrc = buildArcadeGameIframeSrc({
    normalizedUrl,
    roomId,
    launchCapability,
    joinUrl,
    topology: buildEmbeddedRuntimeTopology({
      runtimeMode: parentTopology.runtimeMode as "arcade-live" | "arcade-built",
      surfaceRole: "host",
      runtimeUrl: normalizedUrl,
      parentTopology,
    }),
    arcadeSurface: arcadeSurfaceRuntimeIdentity,
  });
  const iframeTargetOrigin = getRuntimeUrlOrigin(normalizedUrl);

  const establishBridgeChannel = useCallback(() => {
    const contentWindow = iframeRef.current?.contentWindow;
    if (!contentWindow) {
      return;
    }
    if (!iframeTargetOrigin) {
      emitAirJamDevRuntimeEvent({
        event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
        level: "warn",
        message: "Embedded host bridge init blocked: invalid iframe origin",
        role: "host",
        roomId,
        runtimeEpoch: arcadeIdentityRef.current.epoch,
        runtimeKind: "arcade-host-iframe",
        data: {
          gameId: game.id,
          url: normalizedUrl,
        },
      });
      return;
    }

    const attachKey = `${iframeSrc}::${iframeTargetOrigin}`;
    if (settingsBridgeAttachKeyRef.current === attachKey) {
      return;
    }

    settingsBridgeAttachKeyRef.current = attachKey;
    settingsBridgeRef.current.updateSettings(platformSettings);
    settingsBridgeRef.current.attach(contentWindow, iframeTargetOrigin);
  }, [
    game.id,
    iframeSrc,
    iframeTargetOrigin,
    normalizedUrl,
    platformSettings,
    roomId,
  ]);

  useEffect(() => {
    if (!iframeSrc || !isVisible) {
      return;
    }

    establishBridgeChannel();
  }, [establishBridgeChannel, iframeSrc, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    settingsBridgeRef.current.updateSettings(platformSettings);
  }, [isVisible, platformSettings]);

  useEffect(() => {
    const handleSettingsReady = (event: MessageEvent<unknown>) => {
      settingsBridgeRef.current.handleMessage(
        event,
        iframeRef.current?.contentWindow ?? null,
        iframeTargetOrigin,
      );
    };

    window.addEventListener("message", handleSettingsReady);
    return () => {
      window.removeEventListener("message", handleSettingsReady);
    };
  }, [iframeTargetOrigin]);

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

  useEffect(() => {
    const settingsBridge = settingsBridgeRef.current;

    if (pendingBridgeTeardownRef.current) {
      clearTimeout(pendingBridgeTeardownRef.current);
      pendingBridgeTeardownRef.current = null;
    }

    return () => {
      // Defer teardown so React dev effect replay does not permanently sever a live iframe bridge.
      pendingBridgeTeardownRef.current = setTimeout(() => {
        settingsBridge.detach();
        settingsBridgeAttachKeyRef.current = null;
        closeHostBridge("game_unloaded");
        pendingBridgeTeardownRef.current = null;
      }, 0);
    };
  }, [closeHostBridge]);

  const attachHostBridgePort = useCallback(
    (port: MessagePort) => {
      closeHostBridge("replaced");
      hostBridgePortRef.current = port;
      hostBridgeAttachedIdentityRef.current = arcadeSurfaceRuntimeIdentity;
      port.start?.();

      port.onmessage = (event) => {
        const message = parseHostBridgeEmitMessage(event.data);
        if (!message) {
          return;
        }

        hostSocket.emit(
          message.payload.event,
          ...(message.payload.args as never[]),
        );
      };

      const playerNotices: ControllerJoinedNotice[] = players.map((player) => ({
        controllerId: player.id,
        nickname: player.label,
        player,
      }));

      port.postMessage(
        createHostBridgeAttachMessage({
          roomId,
          capabilityToken: launchCapability.token,
          connected: hostSocket.connected,
          socketId: hostSocket.id,
          players: playerNotices,
          state: {
            runtimeState,
          },
          arcadeSurface: arcadeSurfaceRuntimeIdentity,
        }),
      );
    },
    [
      arcadeSurfaceRuntimeIdentity,
      closeHostBridge,
      runtimeState,
      hostSocket,
      launchCapability.token,
      players,
      roomId,
    ],
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

      currentPort.postMessage({
        type: AIRJAM_HOST_BRIDGE_EVENT,
        payload: {
          event: eventName,
          args,
        },
      });
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

      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data &&
        event.data.type === AIRJAM_DEV_PROVIDER_MOUNTED
      ) {
        return;
      }

      if (
        typeof event.data === "object" &&
        event.data !== null &&
        "type" in event.data &&
        event.data.type === AIRJAM_DEV_LOG_SINK_FAILURE
      ) {
        emitAirJamDevRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.browserLogSinkFailure,
          level: "error",
          message: "Embedded browser log sink reported transport failure",
          role: "host",
          roomId,
          runtimeEpoch: arcadeIdentityRef.current.epoch,
          runtimeKind: "arcade-host-iframe",
          data:
            (event.data as { payload?: Record<string, unknown> }).payload ?? {},
        });
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

      if (
        request.payload.roomId !== roomId ||
        request.payload.capabilityToken !== launchCapability.token
      ) {
        port.postMessage(
          createHostBridgeCloseMessage(
            "Embedded host bridge session mismatch.",
          ),
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

      if (!hostSocket.connected) {
        port.postMessage(
          createHostBridgeCloseMessage("Parent host runtime is disconnected."),
        );
        port.close();
        return;
      }

      hostSocket.emit(
        "host:activateEmbeddedGame",
        {
          roomId,
          capabilityToken: launchCapability.token,
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
    };
  }, [
    attachHostBridgePort,
    hostSocket,
    iframeTargetOrigin,
    launchCapability.token,
    roomId,
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
    const handleStateSyncRequest = (payload: {
      roomId: string;
      storeDomain: string;
    }) => {
      forwardHostBridgeEvent("airjam:state_sync_request", payload);
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
    hostSocket.on("airjam:state_sync_request", handleStateSyncRequest);
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
      hostSocket.off("airjam:state_sync_request", handleStateSyncRequest);
      hostSocket.off("server:closeChild", handleCloseChild);
    };
  }, [forwardHostBridgeEvent, hostSocket]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-20 bg-black",
        reducedMotion ? "transition-none" : "transition-transform duration-500",
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
          title={`Air Jam host game: ${game.name}`}
          data-testid="arcade-host-game-frame"
          className="h-full w-full border-none bg-black"
          style={{ backgroundColor: "#000000" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
          onLoad={() => {
            establishBridgeChannel();
          }}
          onError={() => {
            emitAirJamDevRuntimeEvent({
              event: AIRJAM_DEV_LOG_EVENTS.runtime.embeddedBridgeRejected,
              level: "error",
              message: "Embedded game iframe failed to load",
              role: "host",
              roomId,
              runtimeEpoch: arcadeIdentityRef.current.epoch,
              runtimeKind: "arcade-host-iframe",
              data: {
                gameId: game.id,
                src: iframeRef.current?.src ?? iframeSrc,
              },
            });
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
