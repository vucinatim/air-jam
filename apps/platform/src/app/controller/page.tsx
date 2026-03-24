"use client";

import { RemoteDPad } from "@/components/remote-d-pad";
import { Button } from "@/components/ui/button";
import { platformControllerSessionConfig } from "@/lib/airjam-session-config";
import {
  AIRJAM_CONTROLLER_BRIDGE_EVENT,
  type AirJamStateSyncPayload,
  appendRuntimeQueryParams,
  type ClientLoadUiPayload,
  type ControllerBridgeServerEventName,
  type ControllerStateMessage,
  type ControllerWelcomePayload,
  createControllerBridgeAttachMessage,
  createControllerBridgeCloseMessage,
  ControllerSessionProvider,
  type HostLeftNotice,
  normalizeRuntimeUrl,
  parseControllerBridgeEmitMessage,
  parseControllerBridgeRequestMessage,
  type PlaySoundPayload,
  type ServerErrorPayload,
  type SignalPayload,
  useAirJamController,
  useControllerTick,
  useInputWriter,
} from "@air-jam/sdk";
import { ForcedOrientationShell } from "@air-jam/sdk/ui";
import { ArrowLeft, CornerDownLeft, QrCode } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ARCADE_ACTION_TOGGLE_QR = "airjam.arcade.toggle_qr";

const ControllerContent = dynamic(
  () => Promise.resolve(ControllerContentInner),
  {
    ssr: false,
  },
);

export default function ControllerPage() {
  return (
    <ControllerSessionProvider {...platformControllerSessionConfig}>
      <ControllerContent />
    </ControllerSessionProvider>
  );
}
function ControllerContentInner() {
  const controller = useAirJamController();
  const writeInput = useInputWriter();
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  // Use refs to store input state - avoids re-renders and keeps loop stable
  const vectorRef = useRef({ x: 0, y: 0 });
  const actionRef = useRef(false);
  const lastLoopFailLogRef = useRef(0);

  useEffect(() => {
    if (!controller.socket) return;

    const handleLoadUi = (payload: { url: string }) => {
      const normalized = normalizeRuntimeUrl(payload.url);
      if (!normalized) {
        console.warn("[Controller] Blocked client:loadUi with invalid URL", {
          url: payload.url,
        });
        setActiveUrl(null);
        return;
      }
      setActiveUrl(normalized);
    };
    const handleUnloadUi = () => {
      setActiveUrl(null);
    };
    const handleDisconnect = () => {
      setActiveUrl(null);
    };

    controller.socket.on("client:loadUi", handleLoadUi);
    controller.socket.on("client:unloadUi", handleUnloadUi);
    controller.socket.on("disconnect", handleDisconnect);
    return () => {
      controller.socket?.off("client:loadUi", handleLoadUi);
      controller.socket?.off("client:unloadUi", handleUnloadUi);
      controller.socket?.off("disconnect", handleDisconnect);
    };
  }, [controller.socket]);

  // Canonical controller loop: fixed-cadence input publishing.
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

  // --- IFRAME LOGIC ---
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgePortRef = useRef<MessagePort | null>(null);
  const controllerSocketRef = useRef(controller.socket);
  const controllerSessionRef = useRef({
    roomId: controller.roomId,
    controllerId: controller.controllerId,
    gameState: controller.gameState,
    stateMessage: controller.stateMessage,
    players: controller.players,
  });
  const controllerIframeSrc = useMemo(() => {
    if (!activeUrl || !controller.controllerId || !controller.roomId) {
      return null;
    }

    return appendRuntimeQueryParams(activeUrl, {
      aj_controller_id: controller.controllerId,
      aj_room: controller.roomId,
    });
  }, [activeUrl, controller.controllerId, controller.roomId]);

  const emitArcadeAction = useCallback(
    (actionName: string) => {
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
        payload: null,
      });
    },
    [controller.socket, controller.roomId],
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
  }, []);

  useEffect(() => {
    controllerSocketRef.current = controller.socket;
    controllerSessionRef.current = {
      roomId: controller.roomId,
      controllerId: controller.controllerId,
      gameState: controller.gameState,
      stateMessage: controller.stateMessage,
      players: controller.players,
    };
  }, [
    controller.controllerId,
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

      currentPort.postMessage({
        type: AIRJAM_CONTROLLER_BRIDGE_EVENT,
        payload: {
          event,
          args,
        },
      });
    },
    [],
  );

  const attachBridgePort = useCallback(
    (port: MessagePort) => {
      closeBridge("replaced");
      bridgePortRef.current = port;
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
            message: session.stateMessage,
          },
        }),
      );
    },
    [closeBridge],
  );

  // Reset ALL state when activeUrl changes (prevents stale input causing game relaunch)
  useEffect(() => {
    // Reset input refs to prevent ghost inputs when switching between arcade and game
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

      attachBridgePort(port);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      closeBridge("game_unloaded");
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
    const handleLoadUi = (payload: ClientLoadUiPayload) => {
      forwardBridgeEvent("client:loadUi", payload);
    };
    const handleUnloadUi = () => {
      forwardBridgeEvent("client:unloadUi");
    };
    const handleStateSync = (payload: AirJamStateSyncPayload) => {
      forwardBridgeEvent("airjam:state_sync", payload);
    };

    controller.socket.on("connect", handleConnect);
    controller.socket.on("disconnect", handleDisconnect);
    controller.socket.on("server:welcome", handleWelcome);
    controller.socket.on("server:state", handleState);
    controller.socket.on("server:hostLeft", handleHostLeft);
    controller.socket.on("server:error", handleError);
    controller.socket.on("server:signal", handleSignal);
    controller.socket.on("server:playSound", handlePlaySound);
    controller.socket.on("client:loadUi", handleLoadUi);
    controller.socket.on("client:unloadUi", handleUnloadUi);
    controller.socket.on("airjam:state_sync", handleStateSync);

    return () => {
      controller.socket?.off("connect", handleConnect);
      controller.socket?.off("disconnect", handleDisconnect);
      controller.socket?.off("server:welcome", handleWelcome);
      controller.socket?.off("server:state", handleState);
      controller.socket?.off("server:hostLeft", handleHostLeft);
      controller.socket?.off("server:error", handleError);
      controller.socket?.off("server:signal", handleSignal);
      controller.socket?.off("server:playSound", handlePlaySound);
      controller.socket?.off("client:loadUi", handleLoadUi);
      controller.socket?.off("client:unloadUi", handleUnloadUi);
      controller.socket?.off("airjam:state_sync", handleStateSync);
    };
  }, [closeBridge, controller.socket, forwardBridgeEvent]);

  const connectionLabels: Record<
    NonNullable<typeof controller.connectionStatus>,
    string
  > = {
    connected: "Connected",
    connecting: "Connecting",
    disconnected: "Disconnected",
    idle: "Idle",
    reconnecting: "Reconnecting",
  };

  const statusDotClass =
    controller.connectionStatus === "connected"
      ? "bg-emerald-400"
      : controller.connectionStatus === "connecting" ||
          controller.connectionStatus === "reconnecting"
        ? "animate-pulse bg-amber-300"
        : controller.connectionStatus === "idle"
          ? "bg-slate-500"
          : "bg-rose-400";

  const connectionLabel =
    connectionLabels[controller.connectionStatus] ??
    controller.connectionStatus;

  const layout = (
    <div className="text-foreground relative flex h-full min-h-0 w-full touch-none flex-col overflow-hidden bg-black select-none">
      <header className="border-border/40 sticky top-0 z-50 flex shrink-0 items-center border-b px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              Room
            </p>
            <p className="truncate text-lg leading-tight font-semibold">
              {controller.roomId ?? "N/A"}
            </p>
          </div>
        </div>

        <div
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-xs font-medium tracking-wide uppercase"
          aria-live="polite"
          aria-label={`Connection ${connectionLabel}`}
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass}`}
            aria-hidden
          />
          {connectionLabel}
        </div>

        <div className="flex flex-1 justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => emitArcadeAction(ARCADE_ACTION_TOGGLE_QR)}
            aria-label="Toggle host join QR"
            title="Toggle host join QR"
          >
            <QrCode className="h-4 w-4" />
          </Button>
          {activeUrl ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-red-500 hover:border-red-600"
              onClick={() => {
                if (confirm("Exit game and return to arcade?")) {
                  controller.sendSystemCommand("exit");
                }
              }}
              aria-label="Exit game"
              title="Exit game"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
        {/* --- CHILD GAME CONTROLLER --- */}
        {activeUrl && (
          <div className="bg-background absolute inset-0 z-20">
            {controllerIframeSrc ? (
              <iframe
                ref={iframeRef}
                src={controllerIframeSrc}
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

        {/* --- DEFAULT ARCADE CONTROLLER --- */}
        {!activeUrl && (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-8 px-6 py-12">
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
