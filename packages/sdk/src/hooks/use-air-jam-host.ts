/**
 * @module useAirJamHost
 * @description Primary hook for host/game functionality in the AirJam SDK.
 *
 * This hook connects your game to the AirJam server as a "host" and provides
 * all the functionality needed to manage a multiplayer session:
 * - Room management (create/join rooms)
 * - Player tracking (join/leave events, player list)
 * - Input handling (get validated, latched input from controllers)
 * - Signaling (send haptic feedback, toast notifications to controllers)
 * - Game state management (pause/play, broadcast state)
 */
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

/**
 * Options for configuring the host connection.
 *
 * @example Basic usage with callbacks
 * ```tsx
 * const host = useAirJamHost({
 *   onPlayerJoin: (player) => {
 *     console.log(`${player.label} joined!`);
 *     spawnPlayerShip(player.id);
 *   },
 *   onPlayerLeave: (controllerId) => {
 *     console.log(`Player ${controllerId} left`);
 *     removePlayerShip(controllerId);
 *   },
 * });
 * ```
 *
 * @example With custom room ID
 * ```tsx
 * const host = useAirJamHost({
 *   roomId: "GAME1",  // Custom 4-character room code
 *   maxPlayers: 4,    // Override provider's maxPlayers
 * });
 * ```
 */
export interface AirJamHostOptions {
  /**
   * Room ID (4-character code) to use for this session.
   * If not provided, a random room code will be generated.
   * Can also be set via URL query parameter: `?room=XXXX`
   */
  roomId?: string;
  /**
   * Called when a player successfully joins the room.
   * Use this to spawn player entities, update UI, etc.
   */
  onPlayerJoin?: (player: PlayerProfile) => void;
  /**
   * Called when a player leaves the room (disconnects or exits).
   * Use this to remove player entities, handle cleanup.
   */
  onPlayerLeave?: (controllerId: string) => void;
  /**
   * Called when the child window closes in Arcade mode.
   * Only relevant when running as part of the AirJam Platform.
   */
  onChildClose?: () => void;
  /**
   * Force connection even in non-standard modes.
   * @default true
   */
  forceConnect?: boolean;
  /**
   * Override the API key from provider.
   * Useful for per-game API keys in multi-game setups.
   */
  apiKey?: string;
  /**
   * Override the maximum players from provider.
   * @default 8
   */
  maxPlayers?: number;
}

/**
 * Return type of useAirJamHost hook.
 *
 * Provides all the state and functions needed to run a multiplayer game session.
 *
 * @template TSchema - Zod schema type for input (inferred from provider)
 */
export interface AirJamHostApi<TSchema extends z.ZodSchema = z.ZodSchema> {
  /** The room code for this session (e.g., "ABCD") */
  roomId: RoomCode;
  /** Full URL for controllers to join (display as QR code) */
  joinUrl: string;
  /** Current connection status to the server */
  connectionStatus: ConnectionStatus;
  /** List of currently connected players */
  players: PlayerProfile[];
  /** Last error message, if any */
  lastError?: string;
  /** Current run mode (standalone, arcade, platform) */
  mode: RunMode;
  /** Current game state (paused or playing) */
  gameState: GameState;
  /** Toggle between paused and playing states */
  toggleGameState: () => void;
  /**
   * Send state update to all connected controllers.
   * Use for syncing game state, messages, etc.
   */
  sendState: (state: ControllerStatePayload) => boolean;
  /**
   * Send a signal (haptic feedback or toast) to controllers.
   *
   * @example Send haptic to specific player
   * ```ts
   * host.sendSignal("HAPTIC", { pattern: "heavy" }, playerId);
   * ```
   *
   * @example Send toast to all players
   * ```ts
   * host.sendSignal("TOAST", {
   *   title: "Round Start!",
   *   message: "Game begins in 3 seconds",
   * });
   * ```
   */
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
  /** Reconnect to the server */
  reconnect: () => void;
  /** Raw Socket.IO socket instance for advanced usage */
  socket: AirJamSocket;
  /** Whether running in child/arcade mode */
  isChildMode: boolean;
  /**
   * Get the latest input from a specific controller.
   *
   * Returns validated, typed input based on the schema provided to AirJamProvider.
   * If latching is configured, automatically handles latch logic (button presses
   * and stick flicks are "held" until consumed).
   *
   * @example In a game loop
   * ```ts
   * useFrame(() => {
   *   players.forEach((player) => {
   *     const input = host.getInput(player.id);
   *     if (input?.action) {
   *       fireWeapon(player.id);
   *     }
   *     movePlayer(player.id, input?.vector ?? { x: 0, y: 0 });
   *   });
   * });
   * ```
   */
  getInput: (controllerId: string) => z.infer<TSchema> | undefined;
}

/**
 * Primary hook for host/game functionality.
 *
 * Connects to the AirJam server as a host and provides everything needed
 * to manage a multiplayer game session. Must be used within an AirJamProvider.
 *
 * **Features:**
 * - Automatic room creation and management
 * - Real-time player join/leave events
 * - Typed input with validation and latching
 * - Haptic feedback and toast notifications
 * - Game state synchronization
 *
 * @template TSchema - Zod schema for input validation (from provider)
 * @param options - Configuration options for the host
 * @returns API object with state and functions
 *
 * @example Basic usage
 * ```tsx
 * const HostView = () => {
 *   const host = useAirJamHost({
 *     onPlayerJoin: (player) => console.log(`${player.label} joined`),
 *     onPlayerLeave: (id) => console.log(`${id} left`),
 *   });
 *
 *   return (
 *     <div>
 *       <h1>Room: {host.roomId}</h1>
 *       <QRCode value={host.joinUrl} />
 *       <p>Players: {host.players.length}</p>
 *       <button onClick={host.toggleGameState}>
 *         {host.gameState === "playing" ? "Pause" : "Play"}
 *       </button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example Reading input in a game loop
 * ```tsx
 * const GameScene = () => {
 *   const host = useAirJamHost();
 *
 *   useFrame(() => {
 *     host.players.forEach((player) => {
 *       const input = host.getInput(player.id);
 *       if (!input) return;
 *
 *       // Move player based on joystick
 *       movePlayer(player.id, input.vector);
 *
 *       // Handle button press (auto-latched)
 *       if (input.action) {
 *         playerShoot(player.id);
 *       }
 *     });
 *   });
 *
 *   return <GameCanvas />;
 * };
 * ```
 *
 * @example Sending haptic feedback
 * ```tsx
 * const handleHit = (playerId: string) => {
 *   host.sendSignal("HAPTIC", { pattern: "heavy" }, playerId);
 * };
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
