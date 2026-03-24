import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { TOGGLE_DEBOUNCE_MS } from "../../constants";
import { useAirJamContext } from "../../context/air-jam-context";
import { useAssertSessionScope } from "../../context/session-providers";
import type {
  ControllerInputEvent,
  ControllerStateMessage,
  ControllerStatePayload,
  HapticSignalPayload,
  HostRegistrationAck,
  PlayerProfile,
  RoomCode,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../../protocol";
import {
  controllerStateSchema,
  controllerSystemSchema,
  hostCreateRoomSchema,
  hostReconnectSchema,
  roomCodeSchema,
} from "../../protocol";
import { getHostRealtimeClient } from "../../runtime/host-realtime-client";
import type { AirJamRealtimeClient } from "../../runtime/realtime-client";
import { readChildHostRuntimeParams } from "../../runtime/runtime-session-params";
import { detectRunMode } from "../../utils/mode";
import { urlBuilder } from "../../utils/url-builder";
import type { AirJamHostApi, AirJamHostOptions } from "../use-air-jam-host";

export const useHostRuntimeApi = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options: AirJamHostOptions,
  hookName: "useAirJamHost",
): AirJamHostApi<TSchema> => {
  useAssertSessionScope("host", hookName);

  const { config, store, getSocket, disconnectSocket, inputManager } =
    useAirJamContext();

  const arcadeParams = useMemo(() => {
    return readChildHostRuntimeParams();
  }, []);

  const shouldConnect = true;
  const storeRoomId = useStore(store, (s) => s.roomId);

  const parsedRoomId = useMemo<RoomCode | null>(() => {
    if (arcadeParams) {
      return roomCodeSchema.parse(arcadeParams.room.toUpperCase());
    }

    if (storeRoomId) {
      return roomCodeSchema.parse(storeRoomId.toUpperCase());
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

    return null;
  }, [options.roomId, storeRoomId, arcadeParams]);

  const [joinUrl, setJoinUrl] = useState<string>("");

  const onPlayerJoinRef = useRef(options.onPlayerJoin);
  const onPlayerLeaveRef = useRef(options.onPlayerLeave);

  useEffect(() => {
    onPlayerJoinRef.current = options.onPlayerJoin;
    onPlayerLeaveRef.current = options.onPlayerLeave;
  }, [options.onPlayerJoin, options.onPlayerLeave]);

  const connectionState = useStore(
    store,
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      players: state.players,
      gameState: state.gameState,
      mode: state.mode,
      roomId: state.roomId,
    })),
  );

  const socket = useMemo<AirJamRealtimeClient | null>(
    () =>
      shouldConnect ? getHostRealtimeClient((role) => getSocket(role)) : null,
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

    if (!parsedRoomId) return;

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
      if (!socket || !socket.connected || !parsedRoomId) {
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
    socket?.disconnect();
    if (!arcadeParams) {
      disconnectSocket("host");
    }
    if (socket) {
      socket.connect();
    }
  }, [socket, arcadeParams, disconnectSocket]);

  useEffect(() => {
    if (!parsedRoomId) return;

    if (arcadeParams?.joinUrl) {
      setJoinUrl(arcadeParams.joinUrl);
      return;
    }

    (async () => {
      const url = await urlBuilder.buildControllerUrl(parsedRoomId, {
        host: config.publicHost,
      });
      setJoinUrl(url);
    })();
  }, [parsedRoomId, arcadeParams?.joinUrl, config.publicHost, options.roomId]);

  const setRegisteredRoomId = useStore(store, (s) => s.setRegisteredRoomId);

  useEffect(() => {
    const storeState = store.getState();
    storeState.setMode(detectRunMode());
    storeState.setRole("host");
    if (parsedRoomId) {
      storeState.setRoomId(parsedRoomId);
    }
    storeState.setStatus("connecting");
    storeState.setError(undefined);

    if (!shouldConnect || !socket) {
      storeState.setStatus("idle");
      return;
    }

    const registerHost = async () => {
      if (arcadeParams) {
        const childRoomId = roomCodeSchema.parse(arcadeParams.room.toUpperCase());
        const latestState = store.getState();
        latestState.setStatus("connected");
        latestState.setRoomId(childRoomId);
        setRegisteredRoomId(childRoomId);
        return;
      }

      const currentState = store.getState();
      const currentRegisteredRoomId = currentState.registeredRoomId;
      if (currentRegisteredRoomId && socket.connected) {
        return;
      }

      const createNewRoom = () => {
        const payload = hostCreateRoomSchema.parse({
          maxPlayers: config.maxPlayers,
          apiKey: config.apiKey,
        });

        socket.emit("host:createRoom", payload, (ack: HostRegistrationAck) => {
          const latestState = store.getState();
          if (!ack.ok) {
            latestState.setError(ack.message ?? "Failed to create room");
            latestState.setStatus("disconnected");
            setRegisteredRoomId(null);
            return;
          }

          if (ack.roomId) {
            latestState.setStatus("connected");
            latestState.setRoomId(ack.roomId);
            setRegisteredRoomId(ack.roomId);

            if (typeof window !== "undefined") {
              sessionStorage.setItem("airjam_room_id", ack.roomId);
            }
            return;
          }

          latestState.setError("Server did not return room ID");
          latestState.setStatus("disconnected");
        });
      };

      if (typeof window !== "undefined") {
        const savedRoomId = sessionStorage.getItem("airjam_room_id");
        if (savedRoomId) {
          const reconnectPayload = hostReconnectSchema.parse({
            roomId: savedRoomId,
            apiKey: config.apiKey,
          });

          socket.emit("host:reconnect", reconnectPayload, (ack: HostRegistrationAck) => {
            const latestState = store.getState();
            if (ack.ok && ack.roomId) {
              latestState.setStatus("connected");
              latestState.setRoomId(ack.roomId);
              setRegisteredRoomId(ack.roomId);
              return;
            }

            if (typeof window !== "undefined") {
              sessionStorage.removeItem("airjam_room_id");
            }
            createNewRoom();
          });
          return;
        }
      }

      createNewRoom();
    };

    const handleConnect = (): void => {
      store.getState().setStatus("connected");
      void registerHost();
    };

    const handleDisconnect = (): void => {
      store.getState().setStatus("disconnected");
      if (arcadeParams) {
        setRegisteredRoomId(null);
      }
    };

    const handleJoin = (payload: {
      controllerId: string;
      nickname?: string;
      player?: PlayerProfile;
    }): void => {
      if (!payload.player) {
        return;
      }
      store.getState().upsertPlayer(payload.player);
      setTimeout(() => {
        onPlayerJoinRef.current?.(payload.player!);
      }, 0);
    };

    const handleLeave = (payload: { controllerId: string }): void => {
      store.getState().removePlayer(payload.controllerId);
      onPlayerLeaveRef.current?.(payload.controllerId);
    };

    const handleInput = (payload: ControllerInputEvent): void => {
      if (inputManager) {
        inputManager.handleInput(payload);
      }
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (!parsedRoomId || payload.roomId !== parsedRoomId) return;

      const latestState = store.getState();
      if (payload.state.gameState) {
        latestState.setGameState(payload.state.gameState);
      }
      if (payload.state.message !== undefined) {
        latestState.setStateMessage(payload.state.message);
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
    socket.on("server:state", handleState);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:controllerJoined", handleJoin);
      socket.off("server:controllerLeft", handleLeave);
      socket.off("server:input", handleInput);
      socket.off("server:error", handleError);
      socket.off("server:state", handleState);
    };
  }, [
    config.maxPlayers,
    config.apiKey,
    arcadeParams,
    parsedRoomId,
    shouldConnect,
    socket,
    store,
    inputManager,
    setRegisteredRoomId,
  ]);

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
    roomId: parsedRoomId ?? ("" as RoomCode),
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
    socket: socket ?? getHostRealtimeClient((role) => getSocket(role)),
    getInput,
  };
};
