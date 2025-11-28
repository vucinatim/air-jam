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
  onState?: (state: ControllerStatePayload) => void;
}

export interface AirJamControllerApi {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  gameState: GameState;
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
  const roomId = useMemo<RoomCode | null>(() => {
    const code = options.roomId ?? getRoomFromLocation();
    if (!code) {
      return null;
    }
    return roomCodeSchema.parse(code.toUpperCase());
  }, [options.roomId]);

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

  useEffect(() => {
    const store = useConnectionStore.getState();
    store.setMode(detectRunMode());
    store.setRole("controller");
    store.setRoomId(roomId);
    store.setStatus(roomId ? "connecting" : "idle");
    store.setError(undefined);

    if (!roomId) {
      store.setError("No room code provided");
      return;
    }

    const controllerId = generateControllerId();
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

    const handleWelcome = (payload: {
      controllerId: string;
      roomId: RoomCode;
      player?: PlayerProfile;
    }): void => {
      // Check roomId match (case-insensitive for safety)
      // Accept if roomId matches OR if store roomId is null (initial connection)
      const storeRoomId = store.roomId;
      if (
        storeRoomId &&
        payload.roomId.toUpperCase() !== storeRoomId.toUpperCase()
      ) {
        return;
      }
      // Update roomId if it wasn't set yet
      if (!storeRoomId && payload.roomId) {
        store.setRoomId(payload.roomId);
      }
      // Store the player profile if provided
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
      // Update game state if provided
      if (payload.state.gameState) {
        useConnectionStore.getState().setGameState(payload.state.gameState);
      }
      onStateRef.current?.(payload.state);
    };

    const handleHostLeft = (payload: { reason: string }): void => {
      store.setError(payload.reason);
      store.setStatus("disconnected");
    };

    const handleError = (payload: { message: string }): void => {
      store.setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);
    socket.on("server:host_left", handleHostLeft);
    socket.on("server:error", handleError);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
      socket.off("server:host_left", handleHostLeft);
      socket.off("server:error", handleError);
      disconnectSocket("controller");
    };
  }, [options.serverUrl, roomId, reconnectKey]);

  const setNickname = useCallback((value: string) => {
    nicknameRef.current = value;
  }, []);

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

  const socket = useMemo(() => {
    return getSocketClient("controller", options.serverUrl);
  }, [options.serverUrl]);

  return {
    roomId,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    gameState: connectionState.gameState,
    sendInput,
    setNickname,
    reconnect,
    players: connectionState.players,
    socket,
  };
};
