import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ConnectionStatus,
  ControllerInputPayload,
  PlayerProfile,
  RoomCode,
} from "../protocol";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerSystemSchema,
} from "../protocol";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connection-store";
import { detectRunMode } from "../utils/mode";
import { useConnectionHandlers } from "./internal/use-connection-handlers";
import { useRoomSetup } from "./internal/use-room-setup";
import { useSocketLifecycle } from "./internal/use-socket-lifecycle";

interface AirJamShellOptions {
  roomId?: string;
  serverUrl?: string;
  nickname?: string;
  controllerId?: string;
}

export interface AirJamShellApi {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  activeUrl: string | null;
  players: PlayerProfile[];
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
  const nicknameRef = useRef(options.nickname ?? "Arcade Shell");

  // Use internal utilities for setup
  const { parsedRoomId, controllerId } = useRoomSetup({
    roomId: options.roomId,
    role: "controller",
    controllerId: options.controllerId,
    getRoomFromLocation,
  });

  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const connectionState = useConnectionState((state) => ({
    connectionStatus: state.connectionStatus,
    lastError: state.lastError,
    controllerId: state.controllerId,
    players: state.players,
  }));

  // Use socket lifecycle utility
  const { socket } = useSocketLifecycle(
    "controller",
    options.serverUrl,
    !!parsedRoomId,
  );

  // Use connection handlers utility
  const {
    handleConnect: baseHandleConnect,
    handleDisconnect,
    handleError,
  } = useConnectionHandlers();

  useEffect(() => {
    const store = useConnectionStore.getState();
    store.setMode(detectRunMode());
    store.setRole("controller");
    store.setRoomId(parsedRoomId);
    store.setStatus(parsedRoomId ? "connecting" : "idle");
    store.setError(undefined);

    if (!parsedRoomId || !socket || !controllerId) {
      store.setStatus("idle");
      return;
    }

    store.setControllerId(controllerId);

    const handleConnect = (): void => {
      baseHandleConnect();
      const payload = controllerJoinSchema.parse({
        roomId: parsedRoomId,
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
      if (payload.player) {
        store.upsertPlayer(payload.player);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("client:loadUi", handleLoadUi);
    socket.on("client:unloadUi", handleUnloadUi);
    socket.on("server:error", handleError);

    // --- BRIDGE LOGIC ---
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "AIRJAM_INPUT") {
        const input = data.payload as ControllerInputPayload;
        const payload = controllerInputSchema.safeParse({
          roomId: parsedRoomId,
          controllerId: store.controllerId,
          input,
        });
        if (payload.success) {
          socket.emit("controller:input", payload.data);
        }
      } else if (data?.type === "AIRJAM_READY") {
        // Child is ready
      }
    };
    window.addEventListener("message", handleMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("client:loadUi", handleLoadUi);
      socket.off("client:unloadUi", handleUnloadUi);
      socket.off("server:error", handleError);
      window.removeEventListener("message", handleMessage);
    };
  }, [
    options.serverUrl,
    parsedRoomId,
    socket,
    controllerId,
    baseHandleConnect,
    handleDisconnect,
    handleError,
  ]);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      const store = useConnectionStore.getState();

      if (!parsedRoomId || !store.controllerId || !socket) {
        store.setError("Not connected to a room");
        return false;
      }
      if (!socket.connected) {
        return false;
      }

      // Validate that input is an object (not null, not array, etc.)
      if (typeof input !== "object" || input === null || Array.isArray(input)) {
        store.setError("Input must be an object");
        return false;
      }

      const payload = controllerInputSchema.safeParse({
        roomId: parsedRoomId,
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
    [parsedRoomId, socket],
  );

  const sendSystemCommand = useCallback(
    (command: "exit" | "ready" | "toggle_pause") => {
      const store = useConnectionStore.getState();

      if (!parsedRoomId || !store.controllerId || !socket) return;

      if (!socket.connected) return;

      const payload = controllerSystemSchema.safeParse({
        roomId: parsedRoomId,
        command,
      });

      if (payload.success) {
        socket.emit("controller:system", payload.data);
      }
    },
    [parsedRoomId, socket],
  );

  return {
    roomId: parsedRoomId,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    activeUrl,
    players: connectionState.players,
    sendInput,
    sendSystemCommand,
  };
};
