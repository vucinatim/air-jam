import { useCallback } from "react";
import { useAirJamContext } from "../context/air-jam-context";
import type {
  HapticSignalPayload,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";

/**
 * Lightweight hook that provides sendSignal for host-side effects.
 * Use this when you only need to send signals and don't need the full host functionality.
 */
export const useAirJamHostSignal = (): {
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
} => {
  const { getSocket } = useAirJamContext();

  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
      // Get the socket instance from context
      const socket = getSocket("host");
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
    [getSocket],
  ) as {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };

  return { sendSignal };
};
