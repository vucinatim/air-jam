import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TOGGLE_DEBOUNCE_MS } from "../constants";
import { useAirJamContext } from "../context/air-jam-context";
import type { AirJamSocket } from "../context/socket-manager";
import type {
  ConnectionStatus,
  ControllerInputEvent,
  ControllerStateMessage,
  ControllerStatePayload,
  GameState,
  HapticSignalPayload,
  PlayerProfile,
  RoomCode,
  RunMode,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";
import {
  controllerStateSchema,
  controllerSystemSchema,
  hostRegistrationSchema,
  roomCodeSchema,
} from "../protocol";
import { generateRoomCode } from "../utils/ids";
import { detectRunMode } from "../utils/mode";
import { urlBuilder } from "../utils/url-builder";

interface AirJamHostOptions {
  /** Room ID to use (auto-generated if not provided) */
  roomId?: string;
  /** Callback when input is received from a controller */
  onInput?: (event: ControllerInputEvent) => void;
  /** Callback when a player joins */
  onPlayerJoin?: (player: PlayerProfile) => void;
  /** Callback when a player leaves */
  onPlayerLeave?: (controllerId: string) => void;
  /** Callback when child window closes (Arcade mode) */
  onChildClose?: () => void;
  /** Force connection even in non-standard modes */
  forceConnect?: boolean;
  /** Override API key from provider */
  apiKey?: string;
  /** Override max players from provider */
  maxPlayers?: number;
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
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
  reconnect: () => void;
  socket: AirJamSocket;
  isChildMode: boolean;
}

export const useAirJamHost = (
  options: AirJamHostOptions = {},
): AirJamHostApi => {
  // Get context
  const { config, store, getSocket, disconnectSocket } = useAirJamContext();

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
    if (isChildMode) return true;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("airjam_force_connect") === "true") return true;
    }
    return true; // Default to true for Standalone Mode
  }, [options.forceConnect, isChildMode]);

  // Generate fallback room ID once
  const [fallbackRoomId] = useState(() => generateRoomCode());

  // Parse room ID from various sources
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

  const [joinUrl, setJoinUrl] = useState<string>("");

  // Keep callback refs stable
  const onInputRef = useRef(options.onInput);
  const onPlayerJoinRef = useRef(options.onPlayerJoin);
  const onPlayerLeaveRef = useRef(options.onPlayerLeave);
  const onChildCloseRef = useRef(options.onChildClose);

  useEffect(() => {
    onInputRef.current = options.onInput;
    onPlayerJoinRef.current = options.onPlayerJoin;
    onPlayerLeaveRef.current = options.onPlayerLeave;
    onChildCloseRef.current = options.onChildClose;
  }, [
    options.onInput,
    options.onPlayerJoin,
    options.onPlayerLeave,
    options.onChildClose,
  ]);

  // Subscribe to store state
  const connectionState = useStore(
    store,
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      players: state.players,
      gameState: state.gameState,
      mode: state.mode,
    })),
  );

  // Get socket from context
  const socket = useMemo(
    () => (shouldConnect ? getSocket("host") : null),
    [shouldConnect, getSocket],
  );

  const [lastToggle, setLastToggle] = useState(0);

  const toggleGameState = useCallback(() => {
    const now = Date.now();
    if (now - lastToggle < TOGGLE_DEBOUNCE_MS) {
      return;
    }
    setLastToggle(now);

    if (!socket || !socket.connected) {
      return;
    }

    const payload = controllerSystemSchema.safeParse({
      roomId: parsedRoomId,
      command: "toggle_pause",
    });
    if (payload.success) {
      socket.emit("host:system", payload.data);
    }
  }, [socket, parsedRoomId, lastToggle]);

  const sendState = useCallback(
    (state: ControllerStatePayload): boolean => {
      if (!socket || !socket.connected) {
        return false;
      }
      const payload = controllerStateSchema.safeParse({
        roomId: parsedRoomId,
        state,
      });
      if (!payload.success) {
        return false;
      }
      socket.emit("host:state", payload.data);
      return true;
    },
    [socket, parsedRoomId],
  );

  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      if (!socket || !socket.connected) {
        return;
      }
      const signal: SignalPayload = {
        targetId,
        type,
        payload,
      } as SignalPayload;
      socket.emit("host:signal", signal);
    },
    [socket],
  ) as AirJamHostApi["sendSignal"];

  const reconnect = useCallback(() => {
    disconnectSocket("host");
    if (socket) {
      socket.connect();
    }
  }, [socket, disconnectSocket]);

  // Build controller URL
  useEffect(() => {
    (async () => {
      const url = await urlBuilder.buildControllerUrl(parsedRoomId, {
        path: config.controllerPath,
        host: config.publicHost,
      });
      setJoinUrl(url);
    })();
  }, [parsedRoomId, config.controllerPath, config.publicHost]);

  // Track if we've already registered to prevent duplicate registrations
  const registeredRoomIdRef = useRef<RoomCode | null>(null);

  // Main connection effect
  useEffect(() => {
    const storeState = store.getState();
    storeState.setMode(detectRunMode());
    storeState.setRole("host");
    storeState.setRoomId(parsedRoomId);
    storeState.setStatus("connecting");
    storeState.setError(undefined);

    if (!shouldConnect || !socket) {
      storeState.setStatus("idle");
      return;
    }

    const registerHost = async () => {
      const storeState = store.getState();

      // Prevent duplicate registration for the same room
      if (registeredRoomIdRef.current === parsedRoomId && socket.connected) {
        return;
      }

      if (arcadeParams) {
        // Child Mode - join as child
        const childRoomId = roomCodeSchema.parse(
          arcadeParams.room.toUpperCase(),
        );
        const payload = {
          roomId: childRoomId,
          joinToken: arcadeParams.token,
        };
        socket.emit("host:joinAsChild", payload, (ack) => {
          if (!ack.ok) {
            storeState.setError(ack.message ?? "Failed to join as child");
            storeState.setStatus("disconnected");
            registeredRoomIdRef.current = null;
            return;
          }
          storeState.setStatus("connected");
          storeState.setRoomId(childRoomId);
          registeredRoomIdRef.current = childRoomId;
        });
      } else {
        // Standalone Mode - register as master host
        const payload = hostRegistrationSchema.parse({
          roomId: parsedRoomId,
          maxPlayers: options.maxPlayers ?? config.maxPlayers,
          apiKey: options.apiKey ?? config.apiKey,
        });

        socket.emit("host:register", payload, (ack) => {
          if (!ack.ok) {
            storeState.setError(ack.message ?? "Failed to register host");
            storeState.setStatus("disconnected");
            registeredRoomIdRef.current = null;
            return;
          }
          storeState.setStatus("connected");
          if (ack.roomId) {
            storeState.setRoomId(ack.roomId);
            registeredRoomIdRef.current = ack.roomId;
          } else {
            registeredRoomIdRef.current = parsedRoomId;
          }
        });
      }
    };

    const handleConnect = (): void => {
      store.getState().setStatus("connected");
      registerHost();
    };

    const handleDisconnect = (): void => {
      store.getState().setStatus("disconnected");
    };

    const handleJoin = (payload: {
      controllerId: string;
      nickname?: string;
      player?: PlayerProfile;
    }): void => {
      if (payload.player) {
        store.getState().upsertPlayer(payload.player);
        setTimeout(() => {
          onPlayerJoinRef.current?.(payload.player!);
        }, 0);
      }
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      store.getState().removePlayer(payload.controllerId);
      onPlayerLeaveRef.current?.(payload.controllerId);
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      onInputRef.current?.(payload);
    };

    const handleChildClose = (): void => {
      onChildCloseRef.current?.();
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== parsedRoomId) return;

      const storeState = store.getState();
      if (payload.state.gameState) {
        storeState.setGameState(payload.state.gameState);
      }
      if (payload.state.message !== undefined) {
        storeState.setStateMessage(payload.state.message);
      }
    };

    const handleError = (payload: { message: string }): void => {
      store.getState().setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:controllerJoined", handleJoin);
    socket.on("server:controllerLeft", handleLeave);
    socket.on("server:input", handleInput);
    socket.on("server:error", handleError);
    socket.on("server:closeChild", handleChildClose);
    socket.on("server:state", handleState);

    // Connect the socket
    socket.connect();

    // If socket is already connected, register immediately
    if (socket.connected && registeredRoomIdRef.current !== parsedRoomId) {
      registerHost();
    }

    // Reset registered room when parsedRoomId changes
    if (
      registeredRoomIdRef.current &&
      registeredRoomIdRef.current !== parsedRoomId
    ) {
      registeredRoomIdRef.current = null;
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:controllerJoined", handleJoin);
      socket.off("server:controllerLeft", handleLeave);
      socket.off("server:input", handleInput);
      socket.off("server:error", handleError);
      socket.off("server:closeChild", handleChildClose);
      socket.off("server:state", handleState);
    };
  }, [
    config.maxPlayers,
    config.apiKey,
    options.maxPlayers,
    options.apiKey,
    parsedRoomId,
    arcadeParams,
    shouldConnect,
    socket,
    store,
  ]);

  // Ensure we return a valid socket (use a no-op socket if not connected)
  const returnSocket = socket ?? getSocket("host");

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
    sendSignal,
    reconnect,
    socket: returnSocket,
    isChildMode,
  };
};
