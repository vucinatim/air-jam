import { useCallback } from "react";
import type {
  HapticSignalPayload,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";
import { getSocketClient } from "../socket-client";

/**
 * Lightweight hook that provides sendSignal without initializing a connection
 * Use this when you only need to send signals and don't need the full host functionality
 * This prevents multiple host registrations and remounting issues
 */
export const useAirJamHostSignal = (): {
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
} => {
  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      // Get the singleton socket instance (doesn't create new connection)
      const socket = getSocketClient("host");
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
    [],
  ) as {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };

  return { sendSignal };
};
