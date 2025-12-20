import { useCallback } from "react";
import type {
  HapticSignalPayload,
  SoundSignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";
import { useAirJamContext } from "../context/AirJamProvider";

/**
 * Lightweight hook that provides sendSignal without initializing a connection
 */
export const useAirJamHostSignal = (): {
  sendSignal: (
    type: SignalType,
    payload: HapticSignalPayload | SoundSignalPayload | ToastSignalPayload,
    targetId?: string,
  ) => void;
} => {
  const { socket } = useAirJamContext();

  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | SoundSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      if (!socket || !socket.connected) {
        return;
      }

      socket.emit("host:signal", {
        type,
        payload,
        targetId,
      } as any);
    },
    [socket],
  );

  return {
    sendSignal,
  };
};
