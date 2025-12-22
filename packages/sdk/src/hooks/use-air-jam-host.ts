import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
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

export interface AirJamHostOptions {
  /** Room ID to use (auto-generated if not provided) */
  roomId?: string;
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

export interface AirJamHostApi<TSchema extends z.ZodSchema = z.ZodSchema> {
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
  /**
   * Gets input for a specific controller.
   * Returns validated and typed input if schema is provided in AirJamProvider.
   * If latching is configured, applies latching logic.
   */
  getInput: (controllerId: string) => z.infer<TSchema> | undefined;
}

/**
 * Hook for connecting to AirJam as a host and accessing host functionality.
 * Input configuration comes from AirJamProvider (via context).
 *
 * @example
 * ```tsx
 * // In provider (App.tsx)
 * <AirJamProvider input={{ schema: gameInputSchema, latch: {...} }}>
 *   <HostView />
 * </AirJamProvider>
 *
 * // In HostView
 * const host = useAirJamHost({
 *   roomId: "ABC123",
 *   onPlayerJoin: (player) => { ... },
 *   onPlayerLeave: (id) => { ... },
 * });
 * ```
 */
export const useAirJamHost = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options: AirJamHostOptions = {},
): AirJamHostApi<TSchema> => {
  // Get context (includes inputManager from provider)
  const { config, store, getSocket, disconnectSocket, inputManager } =
    useAirJamContext();

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

  // Always connect - forceConnect kept for API compatibility
  const shouldConnect = true;

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

  // Update InputManager room ID when parsedRoomId changes
  useEffect(() => {
    if (inputManager) {
      inputManager.setRoomId(parsedRoomId);
    }
  }, [inputManager, parsedRoomId]);

  const [joinUrl, setJoinUrl] = useState<string>("");

  // Keep callback refs stable
  const onPlayerJoinRef = useRef(options.onPlayerJoin);
  const onPlayerLeaveRef = useRef(options.onPlayerLeave);
  const onChildCloseRef = useRef(options.onChildClose);

  useEffect(() => {
    onPlayerJoinRef.current = options.onPlayerJoin;
    onPlayerLeaveRef.current = options.onPlayerLeave;
    onChildCloseRef.current = options.onChildClose;
  }, [options.onPlayerJoin, options.onPlayerLeave, options.onChildClose]);

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

  // Get setRegisteredRoomId from store
  const setRegisteredRoomId = useStore(store, (s) => s.setRegisteredRoomId);

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
      const currentRegisteredRoomId = store.getState().registeredRoomId;
      if (currentRegisteredRoomId === parsedRoomId && socket.connected) {
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
            setRegisteredRoomId(null);
            return;
          }
          storeState.setStatus("connected");
          storeState.setRoomId(childRoomId);
          setRegisteredRoomId(childRoomId);
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
            setRegisteredRoomId(null);
            return;
          }
          storeState.setStatus("connected");
          if (ack.roomId) {
            storeState.setRoomId(ack.roomId);
            setRegisteredRoomId(ack.roomId);
          } else {
            setRegisteredRoomId(parsedRoomId);
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
      // Handle input via InputManager from context (if configured in provider)
      if (inputManager) {
        inputManager.handleInput(payload);
      }
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
    const currentRegisteredRoomId = store.getState().registeredRoomId;
    if (socket.connected && currentRegisteredRoomId !== parsedRoomId) {
      registerHost();
    }

    // Reset registered room when parsedRoomId changes
    if (currentRegisteredRoomId && currentRegisteredRoomId !== parsedRoomId) {
      setRegisteredRoomId(null);
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
    inputManager,
    setRegisteredRoomId,
  ]);

  // Ensure we return a valid socket
  const returnSocket = socket ?? getSocket("host");

  // Create getInput function using InputManager from context
  const getInput = useCallback(
    (controllerId: string): z.infer<TSchema> | undefined => {
      if (!inputManager) {
        return undefined;
      }
      return inputManager.getInput(controllerId) as
        | z.infer<TSchema>
        | undefined;
    },
    [inputManager],
  );

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
    getInput,
  };
};
