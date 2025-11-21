import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ConnectionStatus,
  ControllerInputEvent,
  ControllerStatePayload,
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
import { disconnectSocket, getSocketClient } from "../socketClient";
import {
  useConnectionState,
  useConnectionStore,
} from "../state/connectionStore";

interface AirJamHostOptions {
  roomId?: string;
  serverUrl?: string;
  controllerPath?: string;
  publicHost?: string;
  maxPlayers?: number;
  onInput?: (event: ControllerInputEvent) => void;
  onPlayerJoin?: (player: PlayerProfile) => void;
  onPlayerLeave?: (controllerId: string) => void;
}

export interface AirJamHostApi {
  roomId: RoomCode;
  joinUrl: string;
  connectionStatus: ConnectionStatus;
  players: PlayerProfile[];
  lastError?: string;
  mode: RunMode;
  sendState: (state: ControllerStatePayload) => boolean;
}

export const useAirJamHost = (
  options: AirJamHostOptions = {}
): AirJamHostApi => {
  const parsedRoomId = useMemo<RoomCode>(() => {
    if (options.roomId) {
      return roomCodeSchema.parse(options.roomId.toUpperCase());
    }
    return generateRoomCode();
  }, [options.roomId]);

  const onInputRef = useRef<AirJamHostOptions["onInput"]>(options.onInput);
  const onPlayerJoinRef = useRef<AirJamHostOptions["onPlayerJoin"]>(
    options.onPlayerJoin
  );
  const onPlayerLeaveRef = useRef<AirJamHostOptions["onPlayerLeave"]>(
    options.onPlayerLeave
  );

  const connectionState = useConnectionState((state) => ({
    connectionStatus: state.connectionStatus,
    players: state.players,
    lastError: state.lastError,
    mode: state.mode,
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
    const storeApi = useConnectionStore;
    const socket = getSocketClient("host", options.serverUrl);

    const seedState = storeApi.getState();
    seedState.setMode(detectRunMode());
    seedState.setRole("host");
    seedState.setRoomId(parsedRoomId);
    seedState.setStatus("connecting");
    seedState.setError(undefined);
    seedState.resetPlayers();

    const maxPlayers = options.maxPlayers ?? 8;

    const registerHost = (): void => {
      const payload = hostRegistrationSchema.parse({
        roomId: parsedRoomId,
        maxPlayers,
      });
      socket.emit("host:register", payload, (ack) => {
        if (!ack.ok) {
          storeApi
            .getState()
            .setError(ack.message ?? "Failed to register host");
          storeApi.getState().setStatus("disconnected");
          return;
        }
        storeApi.getState().setStatus("connected");
      });
    };

    const handleConnect = (): void => {
      storeApi.getState().setStatus("connected");
      registerHost();
    };

    const handleDisconnect = (): void => {
      storeApi.getState().setStatus("disconnected");
    };

    const handleJoin = (payload: {
      controllerId: string;
      nickname?: string;
    }): void => {
      const player: PlayerProfile = {
        id: payload.controllerId,
        label:
          payload.nickname ??
          `Player ${storeApi.getState().players.length + 1}`,
      };
      storeApi.getState().upsertPlayer(player);
      onPlayerJoinRef.current?.(player);
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      storeApi.getState().removePlayer(payload.controllerId);
      onPlayerLeaveRef.current?.(payload.controllerId);
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      if (payload.roomId !== parsedRoomId) {
        return;
      }
      onInputRef.current?.(payload);
    };

    const handleError = (payload: { message: string }): void => {
      storeApi.getState().setError(payload.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:controller_joined", handleJoin);
    socket.on("server:controller_left", handleLeave);
    socket.on("server:input", handleInput);
    socket.on("server:error", handleError);
    socket.on("connect_error", (err) => {
      storeApi.getState().setError(err.message);
    });

    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:controller_joined", handleJoin);
      socket.off("server:controller_left", handleLeave);
      socket.off("server:input", handleInput);
      socket.off("server:error", handleError);
      disconnectSocket("host");
    };
  }, [options.maxPlayers, options.serverUrl, parsedRoomId]);

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
        // Fallback to a basic URL if building fails
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

  return {
    roomId: parsedRoomId,
    joinUrl,
    connectionStatus: connectionState.connectionStatus,
    players: connectionState.players,
    lastError: connectionState.lastError,
    mode: connectionState.mode,
    sendState,
  };
};
