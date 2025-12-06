import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConnectionStatus,
  ControllerInputPayload,
  ControllerStateMessage,
  GameState,
  PlayerProfile,
  RoomCode,
} from "../protocol";
import {
  controllerInputSchema,
  controllerJoinSchema,
  type ControllerStatePayload,
  roomCodeSchema,
} from "../protocol";
import { detectRunMode } from "../utils/mode";
import { generateControllerId } from "../utils/ids";
import { disconnectSocket, getSocketClient } from "../socket-client";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connection-store";

interface AirJamControllerOptions {
  roomId?: string;
  serverUrl?: string;
  nickname?: string;
  controllerId?: string;
  forceConnect?: boolean;
  onState?: (state: ControllerStatePayload) => void;
}

export interface AirJamControllerApi {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  gameState: GameState;
  stateMessage?: string;
  sendInput: (input: ControllerInputPayload) => boolean;
  setNickname: (value: string) => void;
  reconnect: () => void;
  players: PlayerProfile[];
  socket: ReturnType<typeof getSocketClient>;
}

const getRoomFromLocation = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  return code ? code.toUpperCase() : null;
};

export const useAirJamController = (
  options: AirJamControllerOptions = {}
): AirJamControllerApi => {
  const nicknameRef = useRef(options.nickname ?? "");
  // Detect Sub-Controller Mode (via URL params)
  const subControllerParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("aj_room");
    const controllerId = params.get("aj_controller_id");
    if (room && controllerId) {
      return { room, controllerId };
    }
    return null;
  }, []);

  const roomId = useMemo<RoomCode | null>(() => {
    if (subControllerParams) {
        return roomCodeSchema.parse(subControllerParams.room.toUpperCase());
    }
    const code = options.roomId ?? getRoomFromLocation();
    if (!code) {
      return null;
    }
    return roomCodeSchema.parse(code.toUpperCase());
  }, [options.roomId, subControllerParams]);

  const onStateRef = useRef<AirJamControllerOptions["onState"]>(
    options.onState
  );
  useEffect(() => {
    onStateRef.current = options.onState;
  }, [options.onState]);

  const connectionState = useConnectionState((state) => ({
    connectionStatus: state.connectionStatus,
    lastError: state.lastError,
    controllerId: state.controllerId,
    players: state.players,
    gameState: state.gameState,
    stateMessage: state.stateMessage,
  }));

  // Use a key to force reconnection when needed
  const [reconnectKey, setReconnectKey] = useState(0);

  const reconnect = useCallback(() => {
    if (!roomId) return;
    // Disconnect current socket
    disconnectSocket("controller");
    // Force useEffect to re-run by incrementing the key
    setReconnectKey((prev) => prev + 1);
  }, [roomId]);

  const isChildMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("airjam_mode") === "child";
  }, []);

  const shouldConnect = useMemo(() => {
    if (options.forceConnect) return true;
    if (subControllerParams) return true; // Always connect in Sub-Controller Mode
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("airjam_force_connect") === "true";
    }
    return false;
  }, [options.forceConnect, subControllerParams]);

  const canConnect = useMemo(() => !isChildMode || shouldConnect, [isChildMode, shouldConnect]);

  useEffect(() => {
    const store = useConnectionStore.getState();
    store.setMode(detectRunMode());
    store.setRole("controller");
    store.setRoomId(roomId);
    store.setStatus(roomId ? "connecting" : "idle");
    store.setError(undefined);

    if (!canConnect) {
      // --- BRIDGE MODE (Iframe Child) ---
      // We don't connect to socket. We talk to parent.
      store.setStatus("connected"); // Fake connection status for UI

      const handleMessage = (event: MessageEvent) => {
        // Only accept messages from parent
        if (event.source !== window.parent) return;
        
        const data = event.data;
        if (data?.type === "AIRJAM_STATE") {
           const payload = data.payload as ControllerStatePayload;
           if (payload.gameState) store.setGameState(payload.gameState);
           if (payload.message !== undefined) store.setStateMessage(payload.message);
           onStateRef.current?.(payload);
        }
      };

      window.addEventListener("message", handleMessage);
      
      // Notify parent we are ready
      window.parent.postMessage({ type: "AIRJAM_READY" }, "*");

      return () => {
        window.removeEventListener("message", handleMessage);
        store.setStatus("disconnected");
      };
    }

    // --- NORMAL MODE (Direct Socket Connection) ---
    if (!roomId) {
      store.setStatus("idle");
      return;
    }

    const controllerId =
      subControllerParams?.controllerId ||
      options.controllerId ||
      (typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("controllerId")
        : null) ||
      generateControllerId();
    store.setControllerId(controllerId);

    const socket = getSocketClient("controller", options.serverUrl);

    const handleConnect = (): void => {
      store.setStatus("connected");
      
      if (subControllerParams) {
          // --- SUB-CONTROLLER MODE ---
          // We are already joined (the shell joined for us).
          // We just need to start sending inputs.
          // We don't emit controller:join.
          console.log("[useAirJamController] Sub-Controller Mode active. Skipping join.");
          return;
      }

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
      if (!payload.player) {
        const error = `Welcome message received but no player profile included. This indicates a server bug.`;
        store.setError(error);
        console.error(`[useAirJamController] ${error}`);
        return;
      }
      store.upsertPlayer(payload.player);
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== roomId) {
        return;
      }
      if (payload.state.gameState) {
        store.setGameState(payload.state.gameState);
      }
      if (payload.state.message !== undefined) {
        store.setStateMessage(payload.state.message);
      }
      onStateRef.current?.(payload.state);
    };

    const handleHostLeft = (payload: { reason: string }): void => {
      store.setError(payload.reason);
      store.setStatus("disconnected");
      store.resetGameState();

      setTimeout(() => {
        disconnectSocket("controller");
        setReconnectKey((prev) => prev + 1);
      }, 1000);
    };

    const handleError = (payload: { message: string }): void => {
      store.setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);
    socket.on("server:hostLeft", handleHostLeft);
    socket.on("server:error", handleError);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
      socket.off("server:hostLeft", handleHostLeft);
      socket.off("server:error", handleError);
      disconnectSocket("controller");
    };
  }, [options.serverUrl, roomId, reconnectKey, canConnect]);

  const setNickname = useCallback((value: string) => {
    nicknameRef.current = value;
  }, []);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      const store = useConnectionStore.getState();

      if (!canConnect) {
        // Bridge Mode
        if (typeof window !== "undefined") {
            window.parent.postMessage({
                type: "AIRJAM_INPUT",
                payload: input
            }, "*");
        }
        return true;
      }

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
    [options.serverUrl, roomId, canConnect]
  );

  const socket = useMemo(() => {
    return getSocketClient("controller", options.serverUrl);
  }, [options.serverUrl]);

  return {
    roomId,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    gameState: connectionState.gameState,
    stateMessage: connectionState.stateMessage,
    sendInput,
    setNickname,
    reconnect,
    players: connectionState.players,
    socket,
  };
};
