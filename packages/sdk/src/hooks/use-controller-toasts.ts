import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-providers";
import type { SignalPayload, ToastSignalPayload } from "../protocol";

export interface ControllerToast extends ToastSignalPayload {
  id: string;
  receivedAt: number;
}

export interface UseControllerToastsOptions {
  maxToasts?: number;
  defaultDurationMs?: number;
}

const DEFAULT_MAX_TOASTS = 3;
const DEFAULT_TOAST_DURATION_MS = 2200;

const buildToastId = (): string =>
  `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useControllerToasts = (
  options: UseControllerToastsOptions = {},
): {
  toasts: ControllerToast[];
  latestToast: ControllerToast | null;
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;
} => {
  useAssertSessionScope("controller", "useControllerToasts");

  const { getSocket } = useAirJamContext();
  const socket = useMemo(() => getSocket("controller"), [getSocket]);
  const maxToasts = options.maxToasts ?? DEFAULT_MAX_TOASTS;
  const defaultDurationMs = options.defaultDurationMs ?? DEFAULT_TOAST_DURATION_MS;

  const [toasts, setToasts] = useState<ControllerToast[]>([]);
  const toastTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const dismissToast = useCallback((toastId: string) => {
    const timeout = toastTimeoutsRef.current.get(toastId);
    if (timeout) {
      clearTimeout(timeout);
      toastTimeoutsRef.current.delete(toastId);
    }

    setToasts((previous) => previous.filter((toast) => toast.id !== toastId));
  }, []);

  const clearToasts = useCallback(() => {
    for (const timeout of toastTimeoutsRef.current.values()) {
      clearTimeout(timeout);
    }
    toastTimeoutsRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleSignal = (signal: SignalPayload) => {
      if (signal.type !== "TOAST") {
        return;
      }

      const toast: ControllerToast = {
        ...signal.payload,
        id: buildToastId(),
        receivedAt: Date.now(),
      };

      setToasts((previous) => [toast, ...previous].slice(0, maxToasts));

      const duration = toast.duration ?? defaultDurationMs;
      if (duration <= 0) {
        return;
      }

      const timeout = setTimeout(() => {
        dismissToast(toast.id);
      }, duration);
      toastTimeoutsRef.current.set(toast.id, timeout);
    };

    socket.on("server:signal", handleSignal);
    return () => {
      socket.off("server:signal", handleSignal);
    };
  }, [defaultDurationMs, dismissToast, maxToasts, socket]);

  useEffect(
    () => () => {
      for (const timeout of toastTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      toastTimeoutsRef.current.clear();
    },
    [],
  );

  return {
    toasts,
    latestToast: toasts[0] ?? null,
    dismissToast,
    clearToasts,
  };
};
