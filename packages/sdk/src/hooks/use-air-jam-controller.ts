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
  controllerSystemSchema,
  type ControllerStatePayload,
} from "../protocol";
import { disconnectSocket } from "../socket-client";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connection-store";
import { detectRunMode } from "../utils/mode";
import { useConnectionHandlers } from "./internal/use-connection-handlers";
import { useRoomSetup } from "./internal/use-room-setup";
import { useSocketLifecycle } from "./internal/use-socket-lifecycle";

interface AirJamControllerOptions {
  roomId?: string;
  serverUrl?: string;
  nickname?: string;
  controllerId?: string;
  forceConnect?: boolean;
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
  socket: ReturnType<typeof useSocketLifecycle>["socket"];
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

  // Determine roomId - sub-controller override or normal
  const getRoomIdWithSubController = useCallback(() => {
    if (subControllerParams) {
      return subControllerParams.room;
    }
    return options.roomId ?? getRoomFromLocation();
  }, [options.roomId, subControllerParams]);

  // Use room setup utility
  const { parsedRoomId, controllerId } = useRoomSetup({
    roomId: options.roomId,
    role: "controller",
    controllerId: subControllerParams?.controllerId || options.controllerId,
    getRoomFromLocation: getRoomIdWithSubController,
  });

  const onStateRef = useRef<AirJamControllerOptions["onState"]>(
    options.onState,
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
    stateMessage: state.stateMessage,
  }));

  // Use a key to force reconnection when needed
  const [reconnectKey, setReconnectKey] = useState(0);

  const reconnect = useCallback(() => {
    if (!parsedRoomId) return;
    disconnectSocket("controller");
    setReconnectKey((prev) => prev + 1);
  }, [parsedRoomId]);

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

  // Use socket lifecycle utility (only if canConnect)
  const { socket } = useSocketLifecycle(
    "controller",
    options.serverUrl,
    canConnect && !!parsedRoomId,
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

    if (!canConnect) {
      // --- BRIDGE MODE (Iframe Child) ---
      store.setStatus("connected");

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;

        const data = event.data;
        if (data?.type === "AIRJAM_STATE") {
          const payload = data.payload as ControllerStatePayload;
          if (payload.gameState) store.setGameState(payload.gameState);
          if (payload.message !== undefined)
            store.setStateMessage(payload.message);
          onStateRef.current?.(payload);
        }
      };

      window.addEventListener("message", handleMessage);
      window.parent.postMessage({ type: "AIRJAM_READY" }, "*");

      return () => {
        window.removeEventListener("message", handleMessage);
        store.setStatus("disconnected");
      };
    }

    // --- NORMAL MODE (Direct Socket Connection) ---
    if (!parsedRoomId || !socket || !controllerId) {
      store.setStatus("idle");
      return;
    }

    store.setControllerId(controllerId);

    const handleConnect = (): void => {
      baseHandleConnect();

      if (subControllerParams) {
        console.log(
          "[useAirJamController] Sub-Controller Mode active. Skipping join.",
        );
        return;
      }

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
      if (!payload.player) {
        const error = `Welcome message received but no player profile included. This indicates a server bug.`;
        store.setError(error);
        console.error(`[useAirJamController] ${error}`);
        return;
      }
      store.upsertPlayer(payload.player);
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== parsedRoomId) {
        return;
      }
      if (payload.state.gameState) {
        store.setGameState(payload.state.gameState);
      }
      if (payload.state.message !== undefined) {
        store.setStateMessage(payload.state.message);
      }
      onStateRef.current?.(payload.state);
    };

    const handleHostLeft = (payload: { reason: string }): void => {
      store.setError(payload.reason);
      store.setStatus("disconnected");
      store.resetGameState();

      setTimeout(() => {
        disconnectSocket("controller");
        setReconnectKey((prev) => prev + 1);
      }, 1000);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);
    socket.on("server:hostLeft", handleHostLeft);
    socket.on("server:error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
      socket.off("server:hostLeft", handleHostLeft);
      socket.off("server:error", handleError);
    };
  }, [
    options.serverUrl,
    parsedRoomId,
    reconnectKey,
    canConnect,
    socket,
    controllerId,
    subControllerParams,
    baseHandleConnect,
    handleDisconnect,
    handleError,
  ]);

  const setNickname = useCallback((value: string) => {
    nicknameRef.current = value;
  }, []);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      const store = useConnectionStore.getState();

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
    [parsedRoomId, canConnect, socket],
  );

  const sendSystemCommand = useCallback(
    (command: "exit" | "ready" | "toggle_pause") => {
      const store = useConnectionStore.getState();

      if (!canConnect) {
        // Bridge Mode logic for system commands if needed?
        // Currently bridge mode is mostly for inputs.
        // We could post message for system commands too if parent handles them.
        return;
      }

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
    [parsedRoomId, canConnect, socket],
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
