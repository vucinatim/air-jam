/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_CONTROLLER_PATH, DEFAULT_MAX_PLAYERS } from "../constants";
import type { ConnectionRole } from "../protocol";
import { createAirJamStore, type AirJamStore } from "../state/connection-store";
import { SocketManager, type AirJamSocket } from "./socket-manager";

// ============================================================================
// Configuration Types
// ============================================================================

export interface AirJamConfig {
  /** WebSocket server URL. Falls back to env vars or window location */
  serverUrl?: string;
  /** API key for production authentication */
  apiKey?: string;
  /** Path for controller page (default: /joypad) */
  controllerPath: string;
  /** Maximum players allowed in a room */
  maxPlayers: number;
  /** Public host for controller URLs (optional) */
  publicHost?: string;
}

export interface AirJamProviderProps {
  children: ReactNode;
  /** WebSocket server URL. Falls back to VITE_AIR_JAM_SERVER_URL or NEXT_PUBLIC_AIR_JAM_SERVER_URL */
  serverUrl?: string;
  /** API key for production. Falls back to VITE_AIR_JAM_API_KEY or NEXT_PUBLIC_AIR_JAM_API_KEY */
  apiKey?: string;
  /** Path for controller page (default: /joypad) */
  controllerPath?: string;
  /** Maximum players allowed in a room (default: 8) */
  maxPlayers?: number;
  /** Public host for controller URLs */
  publicHost?: string;
}

// ============================================================================
// Context Value
// ============================================================================

export interface AirJamContextValue {
  /** Resolved configuration with env fallbacks */
  config: AirJamConfig;
  /** Context-bound Zustand store */
  store: ReturnType<typeof createAirJamStore>;
  /** Socket manager for this provider instance */
  socketManager: SocketManager;
  /** Get socket for a specific role */
  getSocket: (role: ConnectionRole) => AirJamSocket;
  /** Disconnect socket for a specific role */
  disconnectSocket: (role: ConnectionRole) => void;
}

const AirJamContext = createContext<AirJamContextValue | null>(null);

// ============================================================================
// Environment Variable Resolution
// ============================================================================

// Type-safe access to import.meta.env (Vite)
interface ImportMetaEnv {
  VITE_AIR_JAM_SERVER_URL?: string;
  VITE_AIR_JAM_API_KEY?: string;
}

const getViteEnv = (): ImportMetaEnv | undefined => {
  try {
    // Access import.meta.env dynamically to avoid TS errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    if (meta && typeof meta.env === "object") {
      return meta.env as ImportMetaEnv;
    }
  } catch {
    // import.meta not available
  }
  return undefined;
};

/**
 * Attempts to read server URL from various environment variable formats
 */
const getEnvServerUrl = (): string | undefined => {
  // Vite
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_SERVER_URL) {
    return viteEnv.VITE_AIR_JAM_SERVER_URL;
  }

  // Next.js / Node
  if (typeof process !== "undefined" && process.env) {
    const nextUrl = process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL;
    if (nextUrl) return nextUrl;
  }

  return undefined;
};

/**
 * Attempts to read API key from various environment variable formats
 */
const getEnvApiKey = (): string | undefined => {
  // Vite
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_API_KEY) {
    return viteEnv.VITE_AIR_JAM_API_KEY;
  }

  // Next.js / Node
  if (typeof process !== "undefined" && process.env) {
    const nextKey = process.env.NEXT_PUBLIC_AIR_JAM_API_KEY;
    if (nextKey) return nextKey;
  }

  return undefined;
};

// ============================================================================
// Provider Component
// ============================================================================

export const AirJamProvider = ({
  children,
  serverUrl,
  apiKey,
  controllerPath = DEFAULT_CONTROLLER_PATH,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  publicHost,
}: AirJamProviderProps) => {
  // Resolve config with env fallbacks
  const config = useMemo<AirJamConfig>(
    () => ({
      serverUrl: serverUrl ?? getEnvServerUrl(),
      apiKey: apiKey ?? getEnvApiKey(),
      controllerPath,
      maxPlayers,
      publicHost,
    }),
    [serverUrl, apiKey, controllerPath, maxPlayers, publicHost],
  );

  // Create context-bound store (once per provider)
  const store = useMemo(() => createAirJamStore(), []);

  // Create socket manager (once per provider)
  const socketManager = useMemo(
    () => new SocketManager(config.serverUrl),
    // Only recreate if serverUrl changes - intentionally omitting config

    [config.serverUrl],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketManager.disconnectAll();
    };
  }, [socketManager]);

  // Stable function references - don't recreate when config changes
  const getSocket = useCallback(
    (role: ConnectionRole) => socketManager.getSocket(role),
    [socketManager],
  );

  const disconnectSocket = useCallback(
    (role: ConnectionRole) => socketManager.disconnect(role),
    [socketManager],
  );

  const contextValue = useMemo<AirJamContextValue>(
    () => ({
      config,
      store,
      socketManager,
      getSocket,
      disconnectSocket,
    }),
    [config, store, socketManager, getSocket, disconnectSocket],
  );

  return (
    <AirJamContext.Provider value={contextValue}>
      {children}
    </AirJamContext.Provider>
  );
};

// ============================================================================
// Context Hooks
// ============================================================================

/**
 * Access the AirJam context. Must be used within an AirJamProvider.
 */
export const useAirJamContext = (): AirJamContextValue => {
  const context = useContext(AirJamContext);
  if (!context) {
    throw new Error(
      "useAirJamContext must be used within an AirJamProvider. " +
        "Wrap your app or component tree with <AirJamProvider>.",
    );
  }
  return context;
};

/**
 * Access AirJam configuration
 */
export const useAirJamConfig = (): AirJamConfig => {
  return useAirJamContext().config;
};

/**
 * Access AirJam store state with a selector
 */
export const useAirJamState = <T,>(selector: (state: AirJamStore) => T): T => {
  const { store } = useAirJamContext();
  return useStore(store, useShallow(selector));
};

/**
 * Get a socket for the specified role
 */
export const useAirJamSocket = (role: ConnectionRole): AirJamSocket => {
  const { getSocket } = useAirJamContext();
  return useMemo(() => getSocket(role), [getSocket, role]);
};

// ============================================================================
// Exports
// ============================================================================

export { AirJamContext };
