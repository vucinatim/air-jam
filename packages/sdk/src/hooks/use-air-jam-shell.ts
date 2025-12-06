import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConnectionStatus,
  ControllerInputPayload,
  PlayerProfile,
  RoomCode,
} from "../protocol";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerSystemSchema,
  roomCodeSchema,
} from "../protocol";
import { detectRunMode } from "../utils/mode";
import { generateControllerId } from "../utils/ids";
import { disconnectSocket, getSocketClient } from "../socket-client";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connection-store";

interface AirJamShellOptions {
  roomId?: string;
  serverUrl?: string;
  nickname?: string;
  controllerId?: string;
}

export interface AirJamShellApi {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  activeUrl: string | null;
  players: PlayerProfile[];
  sendInput: (input: ControllerInputPayload) => boolean;
  sendSystemCommand: (type: "EXIT_GAME") => void;
}

const getRoomFromLocation = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  return code ? code.toUpperCase() : null;
};

export const useAirJamShell = (
  options: AirJamShellOptions = {}
): AirJamShellApi => {
  const nicknameRef = useRef(options.nickname ?? "Arcade Shell");
  const roomId = useMemo<RoomCode | null>(() => {
    const code = options.roomId ?? getRoomFromLocation();
    if (!code) {
      return null;
    }
    return roomCodeSchema.parse(code.toUpperCase());
  }, [options.roomId]);

  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const connectionState = useConnectionState((state) => ({
    connectionStatus: state.connectionStatus,
    lastError: state.lastError,
    controllerId: state.controllerId,
    players: state.players,
  }));

  useEffect(() => {
    const store = useConnectionStore.getState();
    store.setMode(detectRunMode());
    store.setRole("controller"); // Shell acts as a controller
    store.setRoomId(roomId);
    store.setStatus(roomId ? "connecting" : "idle");
    store.setError(undefined);

    if (!roomId) {
      store.setStatus("idle");
      return;
    }

    const controllerId =
      options.controllerId ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("controllerId")
        : null) ||
      generateControllerId();
    store.setControllerId(controllerId);

    const socket = getSocketClient("controller", options.serverUrl);

    const handleConnect = (): void => {
      store.setStatus("connected");
      const payload = controllerJoinSchema.parse({
        roomId,
        controllerId,
        nickname: nicknameRef.current || undefined,
      });
      socket.emit("controller:join", payload, (ack) => {
        if (!ack.ok) {
          store.setError(ack.message ?? "Unable to join room");
          store.setStatus("disconnected");
          return;
        }
        if (ack.controllerId) {
          store.setControllerId(ack.controllerId);
        }
        store.setStatus("connected");
      });
    };

    const handleDisconnect = (): void => {
      store.setStatus("disconnected");
    };

    const handleLoadUi = (payload: { url: string }): void => {
        console.log("[useAirJamShell] Received client:load_ui event with URL:", payload.url);
        console.log("[useAirJamShell] Current window location:", typeof window !== "undefined" ? window.location.href : "SSR");
        setActiveUrl(payload.url);
    };

    const handleUnloadUi = (): void => {
        console.log("[useAirJamShell] Unloading UI");
        setActiveUrl(null);
    };

    const handleWelcome = (payload: {
      controllerId: string;
      roomId: RoomCode;
      player?: PlayerProfile;
    }): void => {
      const storeRoomId = store.roomId;
      if (
        storeRoomId &&
        payload.roomId.toUpperCase() !== storeRoomId.toUpperCase()
      ) {
        return;
      }
      if (!storeRoomId && payload.roomId) {
        store.setRoomId(payload.roomId);
      }
      if (payload.player) {
        store.upsertPlayer(payload.player);
      }
    };

    const handleError = (payload: { message: string }): void => {
      store.setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("client:loadUi", handleLoadUi);
    socket.on("client:unloadUi", handleUnloadUi);
    socket.on("server:error", handleError);
    socket.connect();

    // --- BRIDGE LOGIC ---
    const handleMessage = (event: MessageEvent) => {
        // We accept messages from any source (iframe)
        // In production we might want to verify origin if possible, but games can be anywhere.
        
        const data = event.data;
        if (data?.type === "AIRJAM_INPUT") {
            const input = data.payload as ControllerInputPayload;
            // Forward to socket
            const payload = controllerInputSchema.safeParse({
                roomId,
                controllerId: store.controllerId,
                input,
            });
            if (payload.success) {
                socket.emit("controller:input", payload.data);
            }
        } else if (data?.type === "AIRJAM_READY") {
            // Child is ready.
            // We could send initial state if we had it.
        }
    };
    window.addEventListener("message", handleMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("client:loadUi", handleLoadUi);
      socket.off("client:unloadUi", handleUnloadUi);
      socket.off("server:error", handleError);
      window.removeEventListener("message", handleMessage);
      disconnectSocket("controller");
    };
  }, [options.serverUrl, roomId]);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      const store = useConnectionStore.getState();

      if (!roomId || !store.controllerId) {
        store.setError("Not connected to a room");
        return false;
      }
      const socket = getSocketClient("controller", options.serverUrl);
      if (!socket.connected) {
        return false;
      }
      const payload = controllerInputSchema.safeParse({
        roomId,
        controllerId: store.controllerId,
        input,
      });
      if (!payload.success) {
        store.setError(payload.error.message);
        return false;
      }

      socket.emit("controller:input", payload.data);
      return true;
    },
    [options.serverUrl, roomId]
  );

  const sendSystemCommand = useCallback(
    (type: "EXIT_GAME") => {
      const store = useConnectionStore.getState();
      if (!roomId || !store.controllerId) return;
      
      const socket = getSocketClient("controller", options.serverUrl);
      if (!socket.connected) return;

      const payload = controllerSystemSchema.safeParse({
        roomId,
        controllerId: store.controllerId,
        type,
      });

      if (payload.success) {
        socket.emit("controller:system", payload.data);
      }
    },
    [options.serverUrl, roomId]
  );

  return {
    roomId,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    activeUrl,
    players: connectionState.players,
    sendInput,
    sendSystemCommand,
  };
};
