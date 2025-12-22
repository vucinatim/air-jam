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
} from "../protocol";
import { generateControllerId } from "../utils/ids";
import { detectRunMode } from "../utils/mode";

interface AirJamShellOptions {
  /** Room ID to join */
  roomId?: string;
  /** Player nickname */
  nickname?: string;
  /** Controller ID (auto-generated if not provided) */
  controllerId?: string;
}

export interface AirJamShellApi {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  activeUrl: string | null;
  players: PlayerProfile[];
  gameState: GameState;
  sendInput: (input: ControllerInputPayload) => boolean;
  sendSystemCommand: (command: "exit" | "ready" | "toggle_pause") => void;
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
  options: AirJamShellOptions = {},
): AirJamShellApi => {
  // Get context
  const { store, getSocket } = useAirJamContext();

  const nicknameRef = useRef(options.nickname ?? "Arcade Shell");

  // Parse room ID
  const parsedRoomId = useMemo<RoomCode | null>(() => {
    const code = options.roomId ?? getRoomFromLocation();
    if (!code) return null;
    try {
      return roomCodeSchema.parse(code.toUpperCase());
    } catch {
      return null;
    }
  }, [options.roomId]);

  // Generate or use provided controller ID
  const controllerId = useMemo<string>(() => {
    if (options.controllerId) return options.controllerId;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlControllerId = params.get("controllerId");
      if (urlControllerId) return urlControllerId;
    }
    return generateControllerId();
  }, [options.controllerId]);

  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  // Subscribe to store state
  const connectionState = useStore(
    store,
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      controllerId: state.controllerId,
      players: state.players,
      gameState: state.gameState,
    })),
  );

  // Get socket from context
  const socket: AirJamSocket | null = useMemo(
    () => (parsedRoomId ? getSocket("controller") : null),
    [parsedRoomId, getSocket],
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

    if (!parsedRoomId || !socket || !controllerId) {
      storeState.setStatus("idle");
      return;
    }

    storeState.setControllerId(controllerId);

    const handleConnect = (): void => {
      store.getState().setStatus("connected");

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

    const handleLoadUi = (payload: { url: string }): void => {
      setActiveUrl(payload.url);
    };

    const handleUnloadUi = (): void => {
      setActiveUrl(null);
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
      if (payload.player) {
        storeState.upsertPlayer(payload.player);
      }
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

    // Bridge logic for iframe communication
    const handleMessage = (event: MessageEvent) => {
      const storeState = store.getState();
      const data = event.data;
      if (data?.type === "AIRJAM_INPUT") {
        const input = data.payload as ControllerInputPayload;
        const payload = controllerInputSchema.safeParse({
          roomId: parsedRoomId,
          controllerId: storeState.controllerId,
          input,
        });
        if (payload.success) {
          socket.emit("controller:input", payload.data);
        }
      } else if (data?.type === "AIRJAM_READY") {
        // Child is ready
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);
    socket.on("client:loadUi", handleLoadUi);
    socket.on("client:unloadUi", handleUnloadUi);
    socket.on("server:error", handleError);

    window.addEventListener("message", handleMessage);

    // Connect the socket
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
      socket.off("client:loadUi", handleLoadUi);
      socket.off("client:unloadUi", handleUnloadUi);
      socket.off("server:error", handleError);
      window.removeEventListener("message", handleMessage);
    };
  }, [parsedRoomId, socket, controllerId, store]);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      const storeState = store.getState();

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
    [parsedRoomId, socket, store],
  );

  const sendSystemCommand = useCallback(
    (command: "exit" | "ready" | "toggle_pause") => {
      const storeState = store.getState();

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
    [parsedRoomId, socket, store],
  );

  return {
    roomId: parsedRoomId,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    activeUrl,
    players: connectionState.players,
    gameState: connectionState.gameState,
    sendInput,
    sendSystemCommand,
  };
};
