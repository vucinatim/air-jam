import { useCallback } from "react";
import type { ServerErrorPayload } from "../../protocol";
import { useConnectionStore } from "../../state/connection-store";

export interface ConnectionHandlerOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (message: string) => void;
}

/**
 * Provides reusable connection event handlers
 * Handles common patterns for connect, disconnect, and error events
 *
 * @param options - Optional callbacks for customization
 * @returns Event handler functions
 */
export function useConnectionHandlers(options: ConnectionHandlerOptions = {}) {
  const handleConnect = useCallback(() => {
    const store = useConnectionStore.getState();
    store.setStatus("connected");
    options.onConnect?.();
  }, [options.onConnect]);

  const handleDisconnect = useCallback(() => {
    const store = useConnectionStore.getState();
    store.setStatus("disconnected");
    options.onDisconnect?.();
  }, [options.onDisconnect]);

  const handleError = useCallback(
    (payload: ServerErrorPayload) => {
      const store = useConnectionStore.getState();
      store.setError(payload.message);
      options.onError?.(payload.message);
    },
    [options.onError],
  );

  return {
    handleConnect,
    handleDisconnect,
    handleError,
  };
}
