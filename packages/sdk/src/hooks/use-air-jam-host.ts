import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConnectionStatus,
  ControllerInputEvent,
  ControllerStatePayload,
  GameState,
  PlayerProfile,
  RoomCode,
  RunMode,
} from "../protocol";
import {
  controllerStateSchema,
  hostRegistrationSchema,
  roomCodeSchema,
} from "../protocol";
import { detectRunMode } from "../utils/mode";
import { generateRoomCode } from "../utils/ids";
import { buildControllerUrl } from "../utils/links";
import { disconnectSocket, getSocketClient } from "../socket-client";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connection-store";

interface AirJamHostOptions {
  roomId?: string;
  serverUrl?: string;
  controllerPath?: string;
  publicHost?: string;
  maxPlayers?: number;
  onInput?: (event: ControllerInputEvent) => void;
  onPlayerJoin?: (player: PlayerProfile) => void;
  onPlayerLeave?: (controllerId: string) => void;
  apiKey?: string;
  forceConnect?: boolean;
}

export interface AirJamHostApi {
  roomId: RoomCode;
  joinUrl: string;
  connectionStatus: ConnectionStatus;
  players: PlayerProfile[];
  lastError?: string;
  mode: RunMode;
  gameState: GameState;
  toggleGameState: () => void;
  sendState: (state: ControllerStatePayload) => boolean;
  reconnect: () => void;
  socket: ReturnType<typeof getSocketClient>;
  isChildMode: boolean;
}

export const useAirJamHost = (
  options: AirJamHostOptions = {}
): AirJamHostApi => {
  // Detect if running as a child process (in iframe under Platform)
  const isChildMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("airjam_mode") === "child";
  }, []);

  const shouldConnect = useMemo(() => {
    if (options.forceConnect) return true;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("airjam_force_connect") === "true";
    }
    return false;
  }, [options.forceConnect]);

  const [fallbackRoomId] = useState(() => generateRoomCode());

  const parsedRoomId = useMemo<RoomCode>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramRoom = params.get("room");
      if (paramRoom) {
        const result = roomCodeSchema.safeParse(paramRoom.toUpperCase());
        if (result.success) return result.data;
      }
    }

    if (options.roomId) {
      return roomCodeSchema.parse(options.roomId.toUpperCase());
    }
    return fallbackRoomId;
  }, [options.roomId, fallbackRoomId]);

  const onInputRef = useRef<AirJamHostOptions["onInput"]>(options.onInput);
  const onPlayerJoinRef = useRef<AirJamHostOptions["onPlayerJoin"]>(
    options.onPlayerJoin
  );
  const onPlayerLeaveRef = useRef<AirJamHostOptions["onPlayerLeave"]>(
    options.onPlayerLeave
  );

  const connectionState = useConnectionState((state) => ({
    connectionStatus: state.connectionStatus,
    players: state.players,
    lastError: state.lastError,
    mode: state.mode,
    gameState: state.gameState,
  }));

  useEffect(() => {
    onInputRef.current = options.onInput;
  }, [options.onInput]);

  useEffect(() => {
    onPlayerJoinRef.current = options.onPlayerJoin;
  }, [options.onPlayerJoin]);

  useEffect(() => {
    onPlayerLeaveRef.current = options.onPlayerLeave;
  }, [options.onPlayerLeave]);

  const [reconnectKey, setReconnectKey] = useState(0);

  const reconnect = useCallback(() => {
    disconnectSocket("host");
    setReconnectKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const storeApi = useConnectionStore;
    const store = storeApi.getState();
    let lastToggleTime = 0;
    const TOGGLE_DEBOUNCE_MS = 300;

    store.setMode(detectRunMode());
    store.setRole("host");
    store.setRoomId(parsedRoomId);
    store.setStatus("connecting");
    store.setError(undefined);
    store.resetPlayers();

    // --- SOCKET CONNECTION ---
    // If we are in child mode, we only connect if forceConnect is true (which it should be now for iframe games)
    // If we are NOT in child mode, we always connect.
    const canConnect = !isChildMode || shouldConnect;

    if (!canConnect) {
      // If we are in child mode but NOT forced to connect, we are likely in a legacy state or waiting.
      store.setStatus("idle");
      return;
    }

    const socket = getSocketClient("host", options.serverUrl);
    const maxPlayers = options.maxPlayers ?? 8;

    const registerHost = (): void => {
      const payload = hostRegistrationSchema.parse({
        roomId: parsedRoomId,
        maxPlayers,
        apiKey: options.apiKey,
      });
      socket.emit("host:register", payload, (ack) => {
        if (!ack.ok) {
          store.setError(ack.message ?? "Failed to register host");
          store.setStatus("disconnected");
          return;
        }
        store.setStatus("connected");
      });
    };

    const handleConnect = (): void => {
      store.setStatus("connected");
      registerHost();
    };

    const handleDisconnect = (): void => {
      store.setStatus("disconnected");
    };

    const handleJoin = (payload: {
      controllerId: string;
      nickname?: string;
      player?: PlayerProfile;
    }): void => {
      if (!payload.player) {
        const error = `Server did not send player profile for controllerId: ${payload.controllerId}. This indicates a server version mismatch or bug.`;
        store.setError(error);
        console.error(`[useAirJamHost] ${error}`);
        return;
      }
      store.upsertPlayer(payload.player);
      onPlayerJoinRef.current?.(payload.player);
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      store.removePlayer(payload.controllerId);
      onPlayerLeaveRef.current?.(payload.controllerId);
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      if (payload.roomId !== parsedRoomId) return;

      if (payload.input.togglePlayPause) {
        const now = Date.now();
        if (now - lastToggleTime < TOGGLE_DEBOUNCE_MS) return;
        lastToggleTime = now;
        const currentState = storeApi.getState().gameState;
        const newGameState = currentState === "paused" ? "playing" : "paused";
        storeApi.getState().setGameState(newGameState);

        socket.emit("host:state", {
          roomId: parsedRoomId,
          state: { gameState: newGameState },
        });
      }
      onInputRef.current?.(payload);
    };

    const handleError = (payload: { message: string }): void => {
      store.setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:controller_joined", handleJoin);
    socket.on("server:controller_left", handleLeave);
    socket.on("server:input", handleInput);
    socket.on("server:error", handleError);
    socket.on("connect_error", (err) => {
      store.setError(err.message);
    });

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:controller_joined", handleJoin);
      socket.off("server:controller_left", handleLeave);
      socket.off("server:input", handleInput);
      socket.off("server:error", handleError);
      disconnectSocket("host");
    };
  }, [
    options.maxPlayers,
    options.serverUrl,
    parsedRoomId,
    isChildMode,
    options.apiKey,
    reconnectKey,
    shouldConnect,
  ]);

  const [joinUrl, setJoinUrl] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    buildControllerUrl(parsedRoomId, options.controllerPath, options.publicHost)
      .then((url) => {
        if (mounted) {
          setJoinUrl(url);
        }
      })
      .catch(() => {
        if (mounted) {
          const fallback =
            typeof window !== "undefined"
              ? `${window.location.origin}${
                  options.controllerPath || "/joypad"
                }?room=${parsedRoomId}`
              : `http://localhost:5173${
                  options.controllerPath || "/joypad"
                }?room=${parsedRoomId}`;
          setJoinUrl(fallback);
        }
      });

    return () => {
      mounted = false;
    };
  }, [options.controllerPath, options.publicHost, parsedRoomId]);

  const sendState = useCallback(
    (state: ControllerStatePayload): boolean => {
      const payload = controllerStateSchema.safeParse({
        roomId: parsedRoomId,
        state,
      });
      if (!payload.success) {
        useConnectionStore.getState().setError(payload.error.message);
        return false;
      }

      const socket = getSocketClient("host", options.serverUrl);
      if (!socket.connected) {
        return false;
      }
      socket.emit("host:state", payload.data);
      return true;
    },
    [options.serverUrl, parsedRoomId]
  );

  const toggleGameState = useCallback(() => {
    const store = useConnectionStore.getState();
    const currentState = store.gameState;
    const newGameState = currentState === "paused" ? "playing" : "paused";
    store.setGameState(newGameState);

    const socket = getSocketClient("host", options.serverUrl);
    if (socket.connected) {
      socket.emit("host:state", {
        roomId: parsedRoomId,
        state: { gameState: newGameState },
      });
    }
  }, [options.serverUrl, parsedRoomId]);

  const socket = useMemo(() => {
    return getSocketClient("host", options.serverUrl);
  }, [options.serverUrl]);

  return {
    roomId: parsedRoomId,
    joinUrl,
    connectionStatus: connectionState.connectionStatus,
    players: connectionState.players,
    lastError: connectionState.lastError,
    mode: connectionState.mode,
    gameState: connectionState.gameState,
    toggleGameState,
    sendState,
    reconnect,
    socket,
    isChildMode,
  };
};
