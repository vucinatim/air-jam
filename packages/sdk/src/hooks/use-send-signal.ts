import { useCallback } from "react";
import { useAirJamContext } from "../context/air-jam-context";
import type {
  HapticSignalPayload,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "../protocol";

export interface SendSignalFn {
  (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
  (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
}

/**
 * Lightweight hook to get a stable `sendSignal` function.
 * Use this in components that only need to send signals (haptics, toasts)
 * without subscribing to connection state changes.
 *
 * This hook does NOT cause re-renders when connection state changes,
 * making it ideal for frequently-rendered components like projectiles.
 *
 * @example
 * ```tsx
 * const sendSignal = useSendSignal();
 * sendSignal("HAPTIC", { pattern: "light" }, controllerId);
 * ```
 */
export const useSendSignal = (): SendSignalFn => {
  const { getSocket } = useAirJamContext();

  // Get socket directly without subscribing to store state
  // The socket reference is stable from SocketManager
  const sendSignal = useCallback(
    (
      type: SignalType,
      payload: HapticSignalPayload | ToastSignalPayload,
      targetId?: string,
    ): void => {
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
  ) as SendSignalFn;

  return sendSignal;
};

