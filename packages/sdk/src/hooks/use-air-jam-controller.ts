/**
 * @module useAirJamController
 * @description Hook for building mobile/web controllers that connect to AirJam hosts.
 *
 * This hook is used on the controller side (typically a mobile phone) to:
 * - Connect to a game session via room code
 * - Send input (joystick, buttons) to the host
 * - Receive game state updates
 * - Handle haptic feedback signals
 *
 * Controllers automatically handle:
 * - Room joining via URL parameter (?room=XXXX) or props
 * - Haptic feedback (vibration patterns on signal receipt)
 * - Bridge mode for iframe embedding in the AirJam Platform
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import type { AirJamSocket } from "../context/socket-manager";
import type {
  ConnectionStatus,
  ControllerInputPayload,
  ControllerStateMessage,
  GameState,
  PlayerProfile,
  RoomCode,
  SignalPayload,
} from "../protocol";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerSystemSchema,
  roomCodeSchema,
  type ControllerStatePayload,
} from "../protocol";
import { generateControllerId } from "../utils/ids";
import { detectRunMode } from "../utils/mode";

/**
 * Options for configuring the controller connection.
 *
 * @example Basic usage (room from URL)
 * ```tsx
 * // URL: https://yourgame.com/controller?room=ABCD
 * const controller = useAirJamController();
 * // Automatically joins room ABCD
 * ```
 *
 * @example With nickname
 * ```tsx
 * const controller = useAirJamController({
 *   nickname: playerName,
 *   onState: (state) => {
 *     if (state.gameState === "playing") startGame();
 *   },
 * });
 * ```
 */
export interface AirJamControllerOptions {
  /**
   * Room ID (4-character code) to join.
   * Can also be provided via URL query parameter: `?room=XXXX`
   * The URL parameter takes precedence if both are provided.
   */
  roomId?: string;
  /**
   * Player nickname to display in the game.
   * If not provided, the server assigns a random label.
   */
  nickname?: string;
  /**
   * Controller ID for this instance.
   * Auto-generated if not provided. Persists across reconnects.
   */
  controllerId?: string;
  /**
   * Force connection even in non-standard modes (e.g., iframe).
   * @default false
   */
  forceConnect?: boolean;
  /**
   * Called when the host sends a state update (game state, messages, etc.)
   */
  onState?: (state: ControllerStatePayload) => void;
}

/**
 * Return type of useAirJamController hook.
 *
 * Provides state and functions for a mobile/web controller interface.
 */
export interface AirJamControllerApi {
  /** Room code this controller is connected to (or attempting to join) */
  roomId: RoomCode | null;
  /** This controller's unique ID */
  controllerId: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Last error message, if any */
  lastError?: string;
  /** Current game state (paused or playing) */
  gameState: GameState;
  /** Optional message from the host (e.g., "Get Ready!") */
  stateMessage?: string;
  /**
   * Send input to the host.
   *
   * @example Sending joystick and button input
   * ```ts
   * controller.sendInput({
   *   vector: { x: joystickX, y: joystickY },
   *   action: isFirePressed,
   *   ability: isAbilityPressed,
   *   timestamp: Date.now(),
   * });
   * ```
   */
  sendInput: (input: ControllerInputPayload) => boolean;
  /**
   * Send a system command to the host.
   *
   * @example Toggle pause
   * ```ts
   * controller.sendSystemCommand("toggle_pause");
   * ```
   */
  sendSystemCommand: (command: "exit" | "ready" | "toggle_pause") => void;
  /**
   * Update the player nickname.
   * Changes take effect on next connection.
   */
  setNickname: (value: string) => void;
  /** Force reconnection to the room */
  reconnect: () => void;
  /** List of all connected players in the room */
  players: PlayerProfile[];
  /** Raw Socket.IO socket instance (null if not connected) */
  socket: AirJamSocket | null;
}

const getRoomFromLocation = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  return code ? code.toUpperCase() : null;
};

/**
 * Hook for building mobile/web controllers that connect to AirJam hosts.
 *
 * This hook handles all the complexity of connecting a mobile controller to a game:
 * - Automatic room joining from URL parameters
 * - Input sending with validation
 * - Haptic feedback on signal receipt (vibration)
 * - Game state synchronization
 * - Auto-reconnection on disconnect
 *
 * **Typical usage flow:**
 * 1. Player scans QR code on game screen
 * 2. Opens controller URL with ?room=XXXX parameter
 * 3. Controller auto-connects to the game session
 * 4. Player uses joystick/buttons to send input
 * 5. Receives haptic feedback on game events
 *
 * @param options - Configuration options
 * @returns Controller API with state and functions
 *
 * @example Basic controller setup
 * ```tsx
 * const ControllerView = () => {
 *   const controller = useAirJamController();
 *
 *   const handleJoystickMove = (x: number, y: number) => {
 *     controller.sendInput({
 *       vector: { x, y },
 *       action: false,
 *       timestamp: Date.now(),
 *     });
 *   };
 *
 *   const handleFirePress = () => {
 *     controller.sendInput({
 *       vector: { x: 0, y: 0 },
 *       action: true,
 *       timestamp: Date.now(),
 *     });
 *   };
 *
 *   if (controller.connectionStatus !== "connected") {
 *     return <div>Connecting to room {controller.roomId}...</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <Joystick onMove={handleJoystickMove} />
 *       <FireButton onPress={handleFirePress} />
 *       <p>Game: {controller.gameState}</p>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example With state callback
 * ```tsx
 * const controller = useAirJamController({
 *   onState: (state) => {
 *     if (state.message) {
 *       showNotification(state.message);
 *     }
 *   },
 * });
 * ```
 */
export const useAirJamController = (
  options: AirJamControllerOptions = {},
): AirJamControllerApi => {
  // Get context
  const { store, getSocket, disconnectSocket } = useAirJamContext();

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

  // Parse room ID
  const parsedRoomId = useMemo<RoomCode | null>(() => {
    const code =
      subControllerParams?.room ?? options.roomId ?? getRoomFromLocation();
    if (!code) return null;
    try {
      return roomCodeSchema.parse(code.toUpperCase());
    } catch {
      return null;
    }
  }, [options.roomId, subControllerParams]);

  // Generate or use provided controller ID
  const controllerId = useMemo<string>(() => {
    if (subControllerParams?.controllerId) {
      return subControllerParams.controllerId;
    }
    if (options.controllerId) {
      return options.controllerId;
    }
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlControllerId = params.get("controllerId");
      if (urlControllerId) return urlControllerId;
    }
    return generateControllerId();
  }, [options.controllerId, subControllerParams]);

  const onStateRef = useRef<AirJamControllerOptions["onState"]>(
    options.onState,
  );
  useEffect(() => {
    onStateRef.current = options.onState;
  }, [options.onState]);

  // Subscribe to store state
  const connectionState = useStore(
    store,
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      controllerId: state.controllerId,
      players: state.players,
      gameState: state.gameState,
      stateMessage: state.stateMessage,
    })),
  );

  // Reconnect key for forcing reconnection
  const [reconnectKey, setReconnectKey] = useState(0);

  const reconnect = useCallback(() => {
    if (!parsedRoomId) return;
    disconnectSocket("controller");
    setReconnectKey((prev) => prev + 1);
  }, [parsedRoomId, disconnectSocket]);

  const isChildMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("airjam_mode") === "child";
  }, []);

  const shouldConnect = useMemo(() => {
    if (options.forceConnect) return true;
    if (subControllerParams) return true;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("airjam_force_connect") === "true";
    }
    return false;
  }, [options.forceConnect, subControllerParams]);

  const canConnect = useMemo(
    () => !isChildMode || shouldConnect,
    [isChildMode, shouldConnect],
  );

  // Get socket from context (only if can connect and have room)
  const socket = useMemo(
    () => (canConnect && parsedRoomId ? getSocket("controller") : null),
    [canConnect, parsedRoomId, getSocket],
  );

  // Automatically listen for haptic signals
  useEffect(() => {
    if (!socket) return;

    const handleSignal = (signal: SignalPayload) => {
      if (signal.type !== "HAPTIC") return;

      // Browser compatibility check
      if (typeof navigator === "undefined" || !navigator.vibrate) return;

      // TypeScript now knows payload is HapticSignalPayload
      const payload = signal.payload;

      switch (payload.pattern) {
        case "light":
          navigator.vibrate(10);
          break;
        case "medium":
          navigator.vibrate(30);
          break;
        case "heavy":
          navigator.vibrate([50, 20, 50]); // Pulse
          break;
        case "success":
          navigator.vibrate([10, 30, 10]);
          break;
        case "failure":
          navigator.vibrate([50, 50, 50, 50]);
          break;
        case "custom":
          if (Array.isArray(payload.sequence)) {
            navigator.vibrate(payload.sequence);
          } else if (typeof payload.sequence === "number") {
            navigator.vibrate(payload.sequence);
          }
          break;
      }
    };

    socket.on("server:signal", handleSignal);
    return () => {
      socket.off("server:signal", handleSignal);
    };
  }, [socket]);

  // Main connection effect
  useEffect(() => {
    const storeState = store.getState();
    storeState.setMode(detectRunMode());
    storeState.setRole("controller");
    storeState.setRoomId(parsedRoomId);
    storeState.setStatus(parsedRoomId ? "connecting" : "idle");
    storeState.setError(undefined);

    if (!canConnect) {
      // --- BRIDGE MODE (Iframe Child) ---
      storeState.setStatus("connected");

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;

        const data = event.data;
        if (data?.type === "AIRJAM_STATE") {
          const payload = data.payload as ControllerStatePayload;
          if (payload.gameState) storeState.setGameState(payload.gameState);
          if (payload.message !== undefined)
            storeState.setStateMessage(payload.message);
          onStateRef.current?.(payload);
        }
      };

      window.addEventListener("message", handleMessage);
      window.parent.postMessage({ type: "AIRJAM_READY" }, "*");

      return () => {
        window.removeEventListener("message", handleMessage);
        storeState.setStatus("disconnected");
      };
    }

    // --- NORMAL MODE (Direct Socket Connection) ---
    if (!parsedRoomId || !socket || !controllerId) {
      storeState.setStatus("idle");
      return;
    }

    storeState.setControllerId(controllerId);

    const handleConnect = (): void => {
      store.getState().setStatus("connected");

      if (subControllerParams) {
        // Sub-Controller Mode - skip join
        return;
      }

      const payload = controllerJoinSchema.parse({
        roomId: parsedRoomId,
        controllerId,
        nickname: nicknameRef.current || undefined,
      });
      socket.emit("controller:join", payload, (ack) => {
        const storeState = store.getState();
        if (!ack.ok) {
          storeState.setError(ack.message ?? "Unable to join room");
          storeState.setStatus("disconnected");
          return;
        }
        if (ack.controllerId) {
          storeState.setControllerId(ack.controllerId);
        }
        storeState.setStatus("connected");
      });
    };

    const handleDisconnect = (): void => {
      store.getState().setStatus("disconnected");
    };

    const handleWelcome = (payload: {
      controllerId: string;
      roomId: RoomCode;
      player?: PlayerProfile;
    }): void => {
      const storeState = store.getState();
      const storeRoomId = storeState.roomId;
      if (
        storeRoomId &&
        payload.roomId.toUpperCase() !== storeRoomId.toUpperCase()
      ) {
        return;
      }
      if (!storeRoomId && payload.roomId) {
        storeState.setRoomId(payload.roomId);
      }
      if (!payload.player) {
        storeState.setError(
          "Welcome message received but no player profile included.",
        );
        return;
      }
      storeState.upsertPlayer(payload.player);
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
      onStateRef.current?.(payload.state);
    };

    const handleHostLeft = (payload: { reason: string }): void => {
      const storeState = store.getState();
      storeState.setError(payload.reason);
      storeState.setStatus("disconnected");
      storeState.resetGameState();

      setTimeout(() => {
        disconnectSocket("controller");
        setReconnectKey((prev) => prev + 1);
      }, 1000);
    };

    const handleError = (payload: { message: string }): void => {
      store.getState().setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);
    socket.on("server:hostLeft", handleHostLeft);
    socket.on("server:error", handleError);

    // Connect the socket
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
      socket.off("server:hostLeft", handleHostLeft);
      socket.off("server:error", handleError);
    };
  }, [
    parsedRoomId,
    reconnectKey,
    canConnect,
    socket,
    controllerId,
    subControllerParams,
    store,
    disconnectSocket,
  ]);

  const setNickname = useCallback((value: string) => {
    nicknameRef.current = value;
  }, []);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      const storeState = store.getState();

      if (!canConnect) {
        // Bridge Mode
        if (typeof window !== "undefined") {
          window.parent.postMessage(
            {
              type: "AIRJAM_INPUT",
              payload: input,
            },
            "*",
          );
        }
        return true;
      }

      if (!parsedRoomId || !storeState.controllerId || !socket) {
        storeState.setError("Not connected to a room");
        return false;
      }
      if (!socket.connected) {
        return false;
      }

      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        storeState.setError("Input must be an object");
        return false;
      }

      const payload = controllerInputSchema.safeParse({
        roomId: parsedRoomId,
        controllerId: storeState.controllerId,
        input,
      });
      if (!payload.success) {
        storeState.setError(payload.error.message);
        return false;
      }

      socket.emit("controller:input", payload.data);
      return true;
    },
    [parsedRoomId, canConnect, socket, store],
  );

  const sendSystemCommand = useCallback(
    (command: "exit" | "ready" | "toggle_pause") => {
      const storeState = store.getState();

      if (!canConnect) return;
      if (!parsedRoomId || !storeState.controllerId || !socket) return;
      if (!socket.connected) return;

      const payload = controllerSystemSchema.safeParse({
        roomId: parsedRoomId,
        command,
      });

      if (payload.success) {
        socket.emit("controller:system", payload.data);
      }
    },
    [parsedRoomId, canConnect, socket, store],
  );

  return {
    roomId: parsedRoomId,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    gameState: connectionState.gameState,
    stateMessage: connectionState.stateMessage,
    sendInput,
    sendSystemCommand,
    setNickname,
    reconnect,
    players: connectionState.players,
    socket,
  };
};
