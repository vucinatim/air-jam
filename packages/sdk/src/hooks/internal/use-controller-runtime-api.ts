import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../../context/air-jam-context";
import {
  useAssertSessionScope,
  useClaimSessionRuntimeOwner,
} from "../../context/session-providers";
import type {
  ControllerJoinAck,
  ControllerStateMessage,
  ControllerUpdatePlayerProfileAck,
  GameState,
  PlayerProfile,
  PlayerProfilePatch,
  RoomCode,
  SignalPayload,
} from "../../protocol";
import {
  controllerJoinSchema,
  controllerSystemSchema,
  playerProfilePatchSchema,
  roomCodeSchema,
} from "../../protocol";
import type { PlayerUpdatedNotice } from "../../protocol/notices";
import { getControllerRealtimeClient } from "../../runtime/controller-realtime-client";
import type { AirJamRealtimeClient } from "../../runtime/realtime-client";
import { readEmbeddedControllerChildSession } from "../../runtime/embedded-runtime-adapters";
import { generateControllerId } from "../../utils/ids";
import { detectRunMode } from "../../utils/mode";
import type {
  AirJamControllerApi,
  AirJamControllerOptions,
} from "../use-air-jam-controller";

const getRoomFromLocation = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  const code = params.get("room");
  return code ? code.toUpperCase() : null;
};

export const useControllerRuntimeApi = (
  options: AirJamControllerOptions,
  hookName: "useAirJamController",
): AirJamControllerApi => {
  useAssertSessionScope("controller", hookName);
  useClaimSessionRuntimeOwner("controller-runtime", hookName);

  const { store, getSocket, disconnectSocket } = useAirJamContext();
  const nicknameRef = useRef(options.nickname ?? "");
  const avatarIdRef = useRef(options.avatarId ?? "");

  useEffect(() => {
    nicknameRef.current = options.nickname ?? "";
  }, [options.nickname]);

  useEffect(() => {
    avatarIdRef.current = options.avatarId ?? "";
  }, [options.avatarId]);

  const embeddedController = useMemo(
    () => readEmbeddedControllerChildSession(),
    [],
  );

  const parsedRoomId = useMemo<RoomCode | null>(() => {
    const code =
      embeddedController?.roomId ?? options.roomId ?? getRoomFromLocation();
    if (!code) return null;
    try {
      return roomCodeSchema.parse(code.toUpperCase());
    } catch {
      return null;
    }
  }, [options.roomId, embeddedController]);

  const controllerId = useMemo<string>(() => {
    if (embeddedController?.controllerId) {
      return embeddedController.controllerId;
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
  }, [options.controllerId, embeddedController]);

  const onStateRef = useRef<AirJamControllerOptions["onState"]>(
    options.onState,
  );
  useEffect(() => {
    onStateRef.current = options.onState;
  }, [options.onState]);

  const connectionState = useStore(
    store,
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      controllerId: state.controllerId,
      players: state.players,
      gameState: state.gameState,
      controllerOrientation: state.controllerOrientation,
      stateMessage: state.stateMessage,
    })),
  );
  const selfPlayer = useMemo(
    () =>
      connectionState.controllerId
        ? connectionState.players.find(
            (player) => player.id === connectionState.controllerId,
          ) ?? null
        : null,
    [connectionState.controllerId, connectionState.players],
  );

  const [reconnectKey, setReconnectKey] = useState(0);

  const socket = useMemo<AirJamRealtimeClient | null>(
    () =>
      parsedRoomId
        ? getControllerRealtimeClient((role) => getSocket(role))
        : null,
    [parsedRoomId, getSocket],
  );

  const reconnect = useCallback(() => {
    if (!parsedRoomId) return;
    socket?.disconnect();
    if (!embeddedController) {
      disconnectSocket("controller");
    }
    setReconnectKey((prev) => prev + 1);
  }, [parsedRoomId, disconnectSocket, socket, embeddedController]);

  useEffect(() => {
    if (!socket) return;

    const handleSignal = (signal: SignalPayload) => {
      if (signal.type !== "HAPTIC") return;
      if (typeof navigator === "undefined" || !navigator.vibrate) return;

      const payload = signal.payload;

      switch (payload.pattern) {
        case "light":
          navigator.vibrate(10);
          break;
        case "medium":
          navigator.vibrate(30);
          break;
        case "heavy":
          navigator.vibrate([50, 20, 50]);
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
    if (embeddedController?.playerProfile?.label || embeddedController?.playerProfile?.avatarId) {
      const fallbackPlayer: PlayerProfile = {
        id: controllerId,
        label: embeddedController.playerProfile?.label || nicknameRef.current || "Player",
        ...(embeddedController.playerProfile?.avatarId
          ? { avatarId: embeddedController.playerProfile.avatarId }
          : avatarIdRef.current
            ? { avatarId: avatarIdRef.current }
            : {}),
      };
      storeState.upsertPlayer(fallbackPlayer);
    }

    const handleConnect = (): void => {
      store.getState().setStatus("connected");

      if (embeddedController) {
        return;
      }

      const payload = controllerJoinSchema.parse({
        roomId: parsedRoomId,
        controllerId,
        nickname: nicknameRef.current || undefined,
        avatarId: avatarIdRef.current || undefined,
      });
      socket.emit("controller:join", payload, (ack: ControllerJoinAck) => {
        const latestState = store.getState();
        if (!ack.ok) {
          latestState.setError(ack.message ?? "Unable to join room");
          latestState.setStatus("disconnected");
          return;
        }
        if (ack.controllerId) {
          latestState.setControllerId(ack.controllerId);
        }
        latestState.setStatus("connected");
      });
    };

    const handleDisconnect = (reason?: string): void => {
      const latestState = store.getState();
      if (reason) {
        latestState.setError(reason);
      }
      latestState.setStatus("disconnected");
    };

    const handleWelcome = (payload: {
      controllerId: string;
      roomId: RoomCode;
      player?: PlayerProfile;
    }): void => {
      const latestState = store.getState();
      const storeRoomId = latestState.roomId;
      if (
        storeRoomId &&
        payload.roomId.toUpperCase() !== storeRoomId.toUpperCase()
      ) {
        return;
      }
      if (!storeRoomId && payload.roomId) {
        latestState.setRoomId(payload.roomId);
      }
      if (!payload.player) {
        latestState.setError(
          "Welcome message received but no player profile included.",
        );
        return;
      }
      latestState.upsertPlayer(payload.player);
    };

    const handleState = (payload: ControllerStateMessage): void => {
      if (payload.roomId !== parsedRoomId) return;

      const latestState = store.getState();
      if (payload.state.gameState) {
        latestState.setGameState(payload.state.gameState);
      }
      if (payload.state.orientation) {
        latestState.setControllerOrientation(payload.state.orientation);
      }
      if (payload.state.message !== undefined) {
        latestState.setStateMessage(payload.state.message);
      }
      onStateRef.current?.(payload.state);
    };

    const handleHostLeft = (payload: { reason: string }): void => {
      const latestState = store.getState();
      latestState.setError(payload.reason);
      latestState.setStatus("disconnected");
      latestState.resetGameState();

      setTimeout(() => {
        socket.disconnect();
        if (!embeddedController) {
          disconnectSocket("controller");
        }
        setReconnectKey((prev) => prev + 1);
      }, 1000);
    };

    const handleError = (payload: { message: string }): void => {
      store.getState().setError(payload.message);
    };

    const handlePlayerUpdated = (payload: PlayerUpdatedNotice): void => {
      store.getState().upsertPlayer(payload.player);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);
    socket.on("server:hostLeft", handleHostLeft);
    socket.on("server:error", handleError);
    socket.on("server:playerUpdated", handlePlayerUpdated);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
      socket.off("server:hostLeft", handleHostLeft);
      socket.off("server:error", handleError);
      socket.off("server:playerUpdated", handlePlayerUpdated);
    };
  }, [
    parsedRoomId,
    reconnectKey,
    socket,
    controllerId,
    embeddedController,
    store,
    disconnectSocket,
  ]);

  const setNickname = useCallback((value: string) => {
    nicknameRef.current = value;
  }, []);

  const setAvatarId = useCallback((value: string) => {
    avatarIdRef.current = value;
  }, []);

  const updatePlayerProfile = useCallback(
    (patch: PlayerProfilePatch): Promise<ControllerUpdatePlayerProfileAck> => {
      const parsedPatch = playerProfilePatchSchema.safeParse(patch);
      if (!parsedPatch.success) {
        return Promise.resolve({
          ok: false,
          message: parsedPatch.error.message,
        });
      }

      if (!socket || !parsedRoomId) {
        return Promise.resolve({ ok: false, message: "Not connected" });
      }

      if (embeddedController) {
        return Promise.resolve({
          ok: false,
          message:
            "Profile updates are unavailable in embedded controller runtime",
        });
      }

      const controllerIdForPatch = store.getState().controllerId;
      if (!controllerIdForPatch) {
        return Promise.resolve({ ok: false, message: "No controller id" });
      }

      return new Promise((resolve) => {
        socket.emit(
          "controller:updatePlayerProfile",
          {
            roomId: parsedRoomId,
            controllerId: controllerIdForPatch,
            patch: parsedPatch.data,
          },
          (ack: ControllerUpdatePlayerProfileAck) => {
            resolve(ack);
          },
        );
      });
    },
    [parsedRoomId, socket, store, embeddedController],
  );

  const sendSystemCommand = useCallback(
    (command: "exit" | "toggle_pause") => {
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
    gameState: connectionState.gameState as GameState,
    controllerOrientation: connectionState.controllerOrientation,
    stateMessage: connectionState.stateMessage,
    sendSystemCommand,
    setNickname,
    setAvatarId,
    updatePlayerProfile,
    reconnect,
    players: connectionState.players,
    selfPlayer,
    socket,
  };
};
