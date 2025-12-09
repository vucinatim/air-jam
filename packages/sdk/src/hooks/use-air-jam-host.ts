import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_MAX_PLAYERS, TOGGLE_DEBOUNCE_MS } from "../constants";
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
import { disconnectSocket } from "../socket-client";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connection-store";
import { generateRoomCode } from "../utils/ids";
import { detectRunMode } from "../utils/mode";
import { urlBuilder } from "../utils/url-builder";
import { useConnectionHandlers } from "./internal/use-connection-handlers";
import { useSocketLifecycle } from "./internal/use-socket-lifecycle";

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
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
  reconnect: () => void;
  socket: ReturnType<typeof useSocketLifecycle>["socket"];
  isChildMode: boolean;
}

export const useAirJamHost = (
  options: AirJamHostOptions = {},
): AirJamHostApi => {
  // Debug: Track mount count
  const mountCountRef = useRef(0);
  mountCountRef.current += 1;
  console.log(
    `[host] useAirJamHost hook called (mount #${mountCountRef.current})`,
    {
      optionsRoomId: options.roomId,
      stackTrace: new Error().stack?.split("\n").slice(1, 5).join("\n"),
    },
  );

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

  const [fallbackRoomId] = useState(() => {
    const id = generateRoomCode();
    console.log(`[host] Generated fallbackRoomId: ${id}`);
    return id;
  });

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

  // Debug logging to track why parsedRoomId changes
  useEffect(() => {
    console.log(`[host] parsedRoomId changed`, {
      parsedRoomId,
      optionsRoomId: options.roomId,
      fallbackRoomId,
      hasArcadeParams: !!arcadeParams,
    });
  }, [parsedRoomId, options.roomId, fallbackRoomId, arcadeParams]);

  const [joinUrl, setJoinUrl] = useState<string>("");
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

  const connectionState = useConnectionState((state) => ({
    connectionStatus: state.connectionStatus,
    lastError: state.lastError,
    players: state.players,
    gameState: state.gameState,
    mode: state.mode,
  }));

  // Use socket lifecycle utility
  const { socket } = useSocketLifecycle(
    "host",
    options.serverUrl,
    shouldConnect,
  );

  // Use connection handlers utility
  const {
    handleConnect: baseHandleConnect,
    handleDisconnect,
    handleError,
  } = useConnectionHandlers();

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

    if (!parsedRoomId) {
      return;
    }

    // Use system command - server is source of truth for toggling
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
  }, [socket]);

  useEffect(() => {
    (async () => {
      const url = await urlBuilder.buildControllerUrl(parsedRoomId, {
        path: options.controllerPath,
        host: options.publicHost || options.controllerUrl,
      });
      setJoinUrl(url);
    })();
  }, [
    parsedRoomId,
    options.controllerPath,
    options.publicHost,
    options.controllerUrl,
  ]);

  // Track if we've already registered to prevent duplicate registrations
  const registeredRoomIdRef = useRef<RoomCode | null>(null);

  useEffect(() => {
    const store = useConnectionStore.getState();
    store.setMode(detectRunMode());
    store.setRole("host");
    store.setRoomId(parsedRoomId);
    store.setStatus("connecting");
    store.setError(undefined);

    if (!shouldConnect || !socket) {
      store.setStatus("idle");
      return;
    }

    const registerHost = async () => {
      // Prevent duplicate registration for the same room
      if (registeredRoomIdRef.current === parsedRoomId && socket.connected) {
        console.log(
          `[host] Skipping duplicate registration for room ${parsedRoomId}`,
        );
        return;
      }

      if (arcadeParams) {
        // Child Mode - join as child
        const parsedRoomId = roomCodeSchema.parse(
          arcadeParams.room.toUpperCase(),
        );
        const payload = {
          roomId: parsedRoomId,
          joinToken: arcadeParams.token,
        };
        socket.emit("host:joinAsChild", payload, (ack) => {
          if (!ack.ok) {
            store.setError(ack.message ?? "Failed to join as child");
            store.setStatus("disconnected");
            registeredRoomIdRef.current = null;
            return;
          }
          store.setStatus("connected");
          store.setRoomId(parsedRoomId);
          registeredRoomIdRef.current = parsedRoomId;
        });
      } else {
        // Standalone Mode - register as master host
        const payload = hostRegistrationSchema.parse({
          roomId: parsedRoomId,
          maxPlayers: options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
          apiKey: options.apiKey,
        });

        console.log(`[host] Registering host for room ${parsedRoomId}`, {
          socketId: socket.id,
          connected: socket.connected,
          previouslyRegistered: registeredRoomIdRef.current,
        });

        socket.emit("host:register", payload, (ack) => {
          if (!ack.ok) {
            store.setError(ack.message ?? "Failed to register host");
            store.setStatus("disconnected");
            registeredRoomIdRef.current = null;
            return;
          }
          store.setStatus("connected");
          if (ack.roomId) {
            store.setRoomId(ack.roomId);
            registeredRoomIdRef.current = ack.roomId;
          } else {
            registeredRoomIdRef.current = parsedRoomId;
          }
        });
      }
    };

    const handleConnect = (): void => {
      baseHandleConnect();
      registerHost();
    };

    const handleJoin = (payload: {
      controllerId: string;
      nickname?: string;
      player?: PlayerProfile;
    }): void => {
      if (payload.player) {
        store.upsertPlayer(payload.player);
        // Use a timeout to ensure state updates don't conflict with rendering
        // or other immediate side effects, and to allow refs to be up to date
        setTimeout(() => {
          onPlayerJoinRef.current?.(payload.player!);
        }, 0);
      }
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      store.removePlayer(payload.controllerId);
      onPlayerLeaveRef.current?.(payload.controllerId);
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      console.log(`[host] server:input received`, {
        roomId: payload.roomId,
        controllerId: payload.controllerId,
        input: payload.input,
      });
      onInputRef.current?.(payload);
    };

    const handleChildClose = (): void => {
      onChildCloseRef.current?.();
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== parsedRoomId) return;

      const { state } = payload;
      if (state.gameState) {
        store.setGameState(state.gameState);
      }
      if (state.message !== undefined) {
        store.setStateMessage(state.message);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:controllerJoined", handleJoin);
    socket.on("server:controllerLeft", handleLeave);
    socket.on("server:input", handleInput);
    socket.on("server:error", handleError);
    socket.on("server:closeChild", handleChildClose);
    socket.on("server:state", handleState);

    // If socket is already connected (e.g., reused singleton from previous mount),
    // register the host immediately since the "connect" event won't fire again
    // But only if we haven't already registered for this room
    if (socket.connected && registeredRoomIdRef.current !== parsedRoomId) {
      registerHost();
    }

    // Reset registered room when parsedRoomId changes (but not if it's the same)
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
    options.serverUrl,
    options.maxPlayers,
    options.apiKey,
    parsedRoomId,
    arcadeParams,
    shouldConnect,
    socket,
    baseHandleConnect,
    handleDisconnect,
    handleError,
  ]);

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
    socket,
    isChildMode,
  };
};
