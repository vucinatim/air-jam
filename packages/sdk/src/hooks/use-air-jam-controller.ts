import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type {
  ConnectionStatus,
  ControllerInputPayload,
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
import { useAirJamContext } from "../context/AirJamProvider";
import { generateControllerId } from "../utils/ids";

interface AirJamControllerOptions {
  nickname?: string;
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
  socket: any;
}

export const useAirJamController = (
  options: AirJamControllerOptions = {},
): AirJamControllerApi => {
  const client = useAirJamContext();
  const { socket, store } = client;

  const nicknameRef = useRef(options.nickname ?? "");
  const onStateRef = useRef(options.onState);

  useEffect(() => {
    onStateRef.current = options.onState;
  }, [options.onState]);

  // 1. Store Subscription
  const connectionState = store(
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      lastError: state.lastError,
      controllerId: state.controllerId,
      players: state.players,
      gameState: state.gameState,
      stateMessage: state.stateMessage,
      roomId: state.roomId,
    })),
  );

  // 2. Lifecycle & Listeners
  useEffect(() => {
    if (client.role !== "controller") return;

    const handleWelcome = (payload: { controllerId: string; roomId: RoomCode; player?: PlayerProfile }) => {
      if (payload.player) store.getState().upsertPlayer(payload.player);
      if (payload.controllerId) store.getState().setControllerId(payload.controllerId);
    };

    const handleState = (payload: { state: ControllerStatePayload }) => {
      onStateRef.current?.(payload.state);
    };

    socket.on("server:welcome", handleWelcome);
    socket.on("server:state", handleState);

    const join = () => {
      if (typeof window === "undefined") return;
      
      // Ensure we have a roomId
      let rid = store.getState().roomId;
      if (!rid) {
        const params = new URLSearchParams(window.location.search);
        rid = params.get("room") || params.get("aj_room");
        if (rid) {
          rid = rid.toUpperCase();
          store.getState().setRoomId(rid);
        }
      }

      if (!rid) {
        console.warn("[useAirJamController] No room ID found in store or URL");
        return;
      }

      // Ensure we have a controllerId
      let cid = store.getState().controllerId;
      if (!cid) {
        cid = generateControllerId();
        store.getState().setControllerId(cid);
      }

      const payload = controllerJoinSchema.parse({
        roomId: rid,
        controllerId: cid,
        nickname: nicknameRef.current || undefined,
      });

      socket.emit("controller:join", payload, (ack) => {
        if (!ack.ok) {
          store.getState().setError(ack.message);
        } else {
          store.getState().setStatus("connected");
        }
      });
    };

    if (socket.connected) join();
    else socket.once("connect", join);

    return () => {
      socket.off("server:welcome", handleWelcome);
      socket.off("server:state", handleState);
    };
  }, [socket, client.role]);

  return {
    roomId: connectionState.roomId as RoomCode,
    controllerId: connectionState.controllerId,
    connectionStatus: connectionState.connectionStatus,
    lastError: connectionState.lastError,
    gameState: connectionState.gameState,
    stateMessage: connectionState.stateMessage,
    sendInput: (input) => {
      if (!socket.connected || !connectionState.roomId) return false;
      const payload = controllerInputSchema.safeParse({
        roomId: connectionState.roomId,
        controllerId: connectionState.controllerId,
        input,
      });
      if (!payload.success) return false;
      socket.emit("controller:input", payload.data);
      return true;
    },
    sendSystemCommand: (command) => {
      if (!socket.connected || !connectionState.roomId) return;
      const payload = controllerSystemSchema.safeParse({
        roomId: connectionState.roomId,
        command,
      });
      if (payload.success) socket.emit("controller:system", payload.data);
    },
    setNickname: (val) => { nicknameRef.current = val; },
    reconnect: () => client.connect(),
    players: connectionState.players,
    socket,
  };
};
