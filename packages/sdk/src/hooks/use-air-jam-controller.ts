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
import { useAirJamHaptics } from "./use-air-jam-haptics";

interface AirJamControllerOptions {
  /** Room ID to join (can also come from URL ?room= param) */
  roomId?: string;
  /** Player nickname */
  nickname?: string;
  /** Controller ID (auto-generated if not provided) */
  controllerId?: string;
  /** Force connection even in non-standard modes */
  forceConnect?: boolean;
  /** Callback when state changes */
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
  sendSystemCommand: (command: "exit" | "ready" | "toggle_pause") => void;
  setNickname: (value: string) => void;
  reconnect: () => void;
  players: PlayerProfile[];
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

  const onStateRef = useRef<AirJamControllerOptions["onState"]>(options.onState);
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
  useAirJamHaptics(socket);

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
