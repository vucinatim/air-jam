import { useCallback } from "react";
import type { StoreApi } from "zustand";
import type { AirJamStore } from "../../state/connection-store";
import type { ServerErrorPayload } from "../../protocol";

export interface ConnectionHandlerOptions {
  /** Store instance to use (from context) */
  store: StoreApi<AirJamStore>;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
}

/**
 * Provides reusable connection event handlers
 * Handles common patterns for connect, disconnect, and error events
 */
export function useConnectionHandlers(options: ConnectionHandlerOptions) {
  const { store } = options;

  const handleConnect = useCallback(() => {
    store.getState().setStatus("connected");
    options.onConnect?.();
  }, [store, options.onConnect]);

  const handleDisconnect = useCallback(() => {
    store.getState().setStatus("disconnected");
    options.onDisconnect?.();
  }, [store, options.onDisconnect]);

  const handleError = useCallback(
    (payload: ServerErrorPayload) => {
      store.getState().setError(payload.message);
      options.onError?.(payload.message);
    },
    [store, options.onError],
  );

  return {
    handleConnect,
    handleDisconnect,
    handleError,
  };
}
