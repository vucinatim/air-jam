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
  controllerUrl?: string;
  publicHost?: string;
  maxPlayers?: number;
  onInput?: (event: ControllerInputEvent) => void;
  onPlayerJoin?: (player: PlayerProfile) => void;
  onPlayerLeave?: (controllerId: string) => void;
  onChildClose?: () => void;
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
  // Detect if running in Arcade Mode (via URL params)
  const arcadeParams = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("aj_room");
    const token = params.get("aj_token");
    if (room && token) {
      return { room, token };
    }
    return null;
  }, []);

  const isChildMode = !!arcadeParams;

  const shouldConnect = useMemo(() => {
    if (options.forceConnect) return true;
    if (isChildMode) return true; // Always connect in Arcade Mode
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("airjam_force_connect") === "true") return true;
    }
    // Default to true for Standalone Mode (normal usage)
    return true;
  }, [options.forceConnect, isChildMode]);

  const [fallbackRoomId] = useState(() => generateRoomCode());

  const parsedRoomId = useMemo<RoomCode>(() => {
    if (arcadeParams) {
        return roomCodeSchema.parse(arcadeParams.room.toUpperCase());
    }

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
  }, [options.roomId, fallbackRoomId, arcadeParams]);

  const onInputRef = useRef<AirJamHostOptions["onInput"]>(options.onInput);
  const onPlayerJoinRef = useRef<AirJamHostOptions["onPlayerJoin"]>(
    options.onPlayerJoin
  );
  const onPlayerLeaveRef = useRef<AirJamHostOptions["onPlayerLeave"]>(
    options.onPlayerLeave
  );
  const onChildCloseRef = useRef<AirJamHostOptions["onChildClose"]>(
    options.onChildClose
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

  useEffect(() => {
    onChildCloseRef.current = options.onChildClose;
  }, [options.onChildClose]);

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
    if (!shouldConnect) {
      store.setStatus("idle");
      return;
    }

    const socket = getSocketClient("host", options.serverUrl);
    const maxPlayers = options.maxPlayers ?? 8;

    const registerHost = async (): Promise<void> => {
      if (arcadeParams) {
          // --- ARCADE MODE: JOIN AS CHILD ---
          const payload = {
              roomId: parsedRoomId,
              joinToken: arcadeParams.token
          };
          socket.emit("host:join_as_child", payload, (ack) => {
              if (!ack.ok) {
                  store.setError(ack.message ?? "Failed to join as child");
                  store.setStatus("disconnected");
                  return;
              }
              store.setStatus("connected");
          });
      } else {
          // --- STANDALONE MODE: REGISTER ---
          const mode = "master"; // Standalone is always master of its own room
          
          let controllerUrl = options.controllerUrl;
          if (!controllerUrl) {
              // Use buildControllerUrl to get the proper local IP-based URL
              const path = options.controllerPath || "/joypad";
              try {
                  controllerUrl = await buildControllerUrl(
                      parsedRoomId,
                      path,
                      options.publicHost
                  );
                  console.log("[useAirJamHost] buildControllerUrl returned:", controllerUrl);
                  // Remove the room query param since the server will add it
                  const url = new URL(controllerUrl);
                  url.searchParams.delete("room");
                  controllerUrl = url.toString();
                  console.log("[useAirJamHost] Final controllerUrl (after removing room param):", controllerUrl);
              } catch (error) {
                  console.warn("[useAirJamHost] Failed to build controller URL:", error);
                  // Fallback to origin-based URL if buildControllerUrl fails
                  if (typeof window !== "undefined") {
                      controllerUrl = `${window.location.origin}${path}`;
                      console.log("[useAirJamHost] Fallback controllerUrl:", controllerUrl);
                  }
              }
          } else {
              console.log("[useAirJamHost] Using provided controllerUrl:", controllerUrl);
          }

          const payload = hostRegistrationSchema.parse({
            roomId: parsedRoomId,
            maxPlayers,
            apiKey: options.apiKey,
            mode,
            controllerUrl,
          });
          console.log("[useAirJamHost] Registering with server. Payload:", payload);
          socket.emit("host:register", payload, (ack) => {
            if (!ack.ok) {
              store.setError(ack.message ?? "Failed to register host");
              store.setStatus("disconnected");
              return;
            }
            console.log("[useAirJamHost] Successfully registered with server");
            store.setStatus("connected");
          });
      }
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

    const handleChildClose = (): void => {
        onChildCloseRef.current?.();
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:controller_joined", handleJoin);
    socket.on("server:controller_left", handleLeave);
    socket.on("server:input", handleInput);
    socket.on("server:error", handleError);
    socket.on("server:close_child", handleChildClose);
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
      socket.off("server:close_child", handleChildClose);
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
