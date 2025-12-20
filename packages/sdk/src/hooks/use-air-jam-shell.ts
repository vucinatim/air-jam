import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type {
  AirJamShellApi,
  ControllerInputPayload,
} from "../protocol";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerSystemSchema,
} from "../protocol";
import { useAirJamContext } from "../context/AirJamProvider";
import { useAirJamHaptics } from "./use-air-jam-haptics";
import { generateControllerId } from "../utils/ids";

interface AirJamShellOptions {
  nickname?: string;
}

/**
 * Specialized hook for the Air Jam Shell (Arcade Mode).
 * Consumes the context-bound client.
 */
export const useAirJamShell = (
  options: AirJamShellOptions = {},
): AirJamShellApi => {
  const { socket, store, role } = useAirJamContext();
  const nicknameRef = useRef(options.nickname ?? "Arcade Shell");
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  const { connectionStatus, controllerId, players, gameState, roomId, lastError } = store(
    useShallow((state) => ({
      connectionStatus: state.connectionStatus,
      controllerId: state.controllerId,
      players: state.players,
      gameState: state.gameState,
      roomId: state.roomId,
      lastError: state.lastError,
    }))
  );

  // Automatically listen for haptic signals
  useAirJamHaptics(socket);

  // 2. Room & ID Resolution Logic (Ensure we have a room to join)
  useEffect(() => {
    if (role !== "controller") return;
    
    // If we don't have a roomId, try to parse it from the URL
    if (!roomId && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const paramRoom = params.get("room") || params.get("aj_room");
      if (paramRoom) {
        store.getState().setRoomId(paramRoom.toUpperCase());
      }
    }

    // Ensure we have a controllerId
    if (!controllerId) {
      store.getState().setControllerId(generateControllerId());
    }
  }, [role, roomId, controllerId, store]);

  // 3. Connection Lifecycle & Join Logic
  useEffect(() => {
    if (role !== "controller") return;
    // We don't exit early here anymore, we wait for roomId/controllerId to be set via the other effect or store
    if (!roomId || !controllerId) return;

    const handleConnect = (): void => {
      const payload = controllerJoinSchema.parse({
        roomId,
        controllerId,
        nickname: nicknameRef.current || undefined,
      });
      
      console.log(`[useAirJamShell] Joining room: ${roomId} as ${controllerId}`);
      
      socket.emit("controller:join", payload, (ack: { ok: boolean; message?: string; controllerId?: string }) => {
        if (!ack.ok) {
          console.error(`[useAirJamShell] Join failed: ${ack.message}`);
          store.getState().setError(ack.message ?? "Unable to join room");
          store.getState().setStatus("disconnected");
          return;
        }
        if (ack.controllerId) {
          store.getState().setControllerId(ack.controllerId);
        }
        store.getState().setStatus("connected");
      });
    };

    const handleLoadUi = (payload: { url: string }): void => {
      setActiveUrl(payload.url);
    };

    const handleUnloadUi = (): void => {
      setActiveUrl(null);
    };

    socket.on("connect", handleConnect);
    socket.on("client:loadUi", handleLoadUi);
    socket.on("client:unloadUi", handleUnloadUi);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("client:loadUi", handleLoadUi);
      socket.off("client:unloadUi", handleUnloadUi);
    };
  }, [socket, role, roomId, controllerId, store]);

  const sendInput = useCallback(
    (input: ControllerInputPayload): boolean => {
      if (!roomId || !controllerId || !socket.connected) return false;

      const payload = controllerInputSchema.safeParse({
        roomId,
        controllerId,
        input,
      });
      if (!payload.success) return false;

      socket.emit("controller:input", payload.data);
      return true;
    },
    [socket, roomId, controllerId],
  );

  const sendSystemCommand = useCallback(
    (command: "exit" | "ready" | "toggle_pause") => {
      if (!roomId || !socket.connected) return;

      const payload = controllerSystemSchema.safeParse({
        roomId,
        command,
      });

      if (payload.success) {
        socket.emit("controller:system", payload.data);
      }
    },
    [socket, roomId],
  );

  return {
    roomId,
    controllerId,
    connectionStatus,
    lastError,
    activeUrl,
    players,
    gameState,
    sendInput,
    sendSystemCommand,
  };
};
