/* eslint-disable react-refresh/only-export-components */
/**
 * @module AirJamContext
 * @description Core context and provider for the AirJam SDK.
 *
 * The AirJamProvider is the root component that must wrap your application
 * to enable AirJam functionality. It manages:
 * - WebSocket connections to the AirJam server
 * - Global state via Zustand store
 * - Input validation and latching configuration
 * - Environment variable resolution for server URLs and API keys
 *
 * @example Basic Setup
 * ```tsx
 * import { AirJamProvider } from "@air-jam/sdk";
 *
 * const App = () => (
 *   <AirJamProvider>
 *     <YourGame />
 *   </AirJamProvider>
 * );
 * ```
 *
 * @example With Input Configuration
 * ```tsx
 * import { AirJamProvider } from "@air-jam/sdk";
 * import { z } from "zod";
 *
 * const inputSchema = z.object({
 *   vector: z.object({ x: z.number(), y: z.number() }),
 *   action: z.boolean(),
 * });
 *
 * const App = () => (
 *   <AirJamProvider
 *     input={{
 *       schema: inputSchema,
 *       latch: { booleanFields: ["action"], vectorFields: ["vector"] },
 *     }}
 *   >
 *     <YourGame />
 *   </AirJamProvider>
 * );
 * ```
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { z } from "zod";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DEFAULT_MAX_PLAYERS } from "../constants";
import { InputManager, type InputConfig } from "../internal/input-manager";
import type { ConnectionRole } from "../protocol";
import { createAirJamStore, type AirJamStore } from "../state/connection-store";
import { SocketManager, type AirJamSocket } from "./socket-manager";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Resolved configuration for the AirJam SDK.
 * Created from AirJamProviderProps with environment variable fallbacks applied.
 */
export interface AirJamConfig {
  /** WebSocket server URL. Falls back to env vars or window location */
  serverUrl?: string;
  /** API key for production authentication */
  apiKey?: string;
  /** Maximum players allowed in a room */
  maxPlayers: number;
  /** Public host for controller URLs (optional) */
  publicHost?: string;
}

/**
 * Props for the AirJamProvider component.
 *
 * @template TSchema - Zod schema type for input validation (inferred from input.schema)
 *
 * @example Minimal configuration (uses environment variables)
 * ```tsx
 * <AirJamProvider>
 *   <App />
 * </AirJamProvider>
 * ```
 *
 * @example Full configuration
 * ```tsx
 * <AirJamProvider
 *   serverUrl="wss://your-server.com"
 *   apiKey="your-api-key"
 *   maxPlayers={4}
 *   input={{
 *     schema: myInputSchema,
 *     latch: { booleanFields: ["fire"], vectorFields: ["move"] },
 *   }}
 * >
 *   <App />
 * </AirJamProvider>
 * ```
 */
export interface AirJamProviderProps<
  TSchema extends z.ZodSchema = z.ZodSchema,
> {
  /** React children to render within the provider */
  children: ReactNode;
  /**
   * WebSocket server URL for AirJam connections.
   * Falls back to VITE_AIR_JAM_SERVER_URL or NEXT_PUBLIC_AIR_JAM_SERVER_URL environment variables.
   */
  serverUrl?: string;
  /**
   * API key for production authentication.
   * Falls back to VITE_AIR_JAM_API_KEY or NEXT_PUBLIC_AIR_JAM_API_KEY environment variables.
   */
  apiKey?: string;
  /**
   * Maximum number of players allowed in a room.
   * @default 8
   */
  maxPlayers?: number;
  /**
   * Public hostname for controller URLs.
   * Useful when your app is behind a proxy or has a different public URL.
   */
  publicHost?: string;
  /**
   * Input handling configuration including Zod schema validation and latching.
   * When provided, enables typed input with automatic validation and latch support.
   *
   * @example
   * ```ts
   * input={{
   *   schema: z.object({
   *     vector: z.object({ x: z.number(), y: z.number() }),
   *     action: z.boolean(),
   *     ability: z.boolean(),
   *   }),
   *   latch: {
   *     booleanFields: ["action", "ability"],  // Latch button presses
   *     vectorFields: ["vector"],               // Latch stick flicks
   *   },
   * }}
   * ```
   */
  input?: InputConfig<TSchema>;
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
  /** InputManager instance (created from input config if provided) */
  inputManager: InputManager | null;
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

/**
 * Root provider component for the AirJam SDK.
 *
 * Wrap your application (or game component tree) with this provider to enable
 * AirJam functionality. The provider manages WebSocket connections, global state,
 * and input processing.
 *
 * **Key responsibilities:**
 * - Creates and manages WebSocket connections to the AirJam server
 * - Provides a Zustand store for connection state (players, game state, etc.)
 * - Creates an InputManager for typed input validation and latching
 * - Resolves configuration from props and environment variables
 *
 * @template TSchema - Zod schema for input validation (inferred from props)
 *
 * @example Basic usage
 * ```tsx
 * import { AirJamProvider } from "@air-jam/sdk";
 *
 * export const App = () => (
 *   <AirJamProvider>
 *     <Routes>
 *       <Route path="/" element={<HostView />} />
 *       <Route path="/controller" element={<ControllerView />} />
 *     </Routes>
 *   </AirJamProvider>
 * );
 * ```
 *
 * @example With typed input and latching
 * ```tsx
 * import { AirJamProvider } from "@air-jam/sdk";
 * import { z } from "zod";
 *
 * const gameInputSchema = z.object({
 *   vector: z.object({ x: z.number(), y: z.number() }),
 *   action: z.boolean(),
 *   ability: z.boolean(),
 *   timestamp: z.number(),
 * });
 *
 * export const App = () => (
 *   <AirJamProvider
 *     input={{
 *       schema: gameInputSchema,
 *       latch: {
 *         booleanFields: ["action", "ability"],
 *         vectorFields: ["vector"],
 *       },
 *     }}
 *   >
 *     <GameRoutes />
 *   </AirJamProvider>
 * );
 * ```
 */
export const AirJamProvider = <TSchema extends z.ZodSchema = z.ZodSchema>({
  children,
  serverUrl,
  apiKey,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  publicHost,
  input,
}: AirJamProviderProps<TSchema>) => {
  // Resolve config with env fallbacks
  const config = useMemo<AirJamConfig>(
    () => ({
      serverUrl: serverUrl ?? getEnvServerUrl(),
      apiKey: apiKey ?? getEnvApiKey(),
      maxPlayers,
      publicHost,
    }),
    [serverUrl, apiKey, maxPlayers, publicHost],
  );

  // Create InputManager from input config if provided
  const inputManager = useMemo(() => {
    if (!input) {
      return null;
    }
    return new InputManager<TSchema>(input);
  }, [input]);

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
      inputManager,
    }),
    [config, store, socketManager, getSocket, disconnectSocket, inputManager],
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
 * Access the raw AirJam context value.
 *
 * This is a low-level hook that provides direct access to the context.
 * Most applications should use the higher-level hooks instead:
 * - `useAirJamHost()` - For host/game functionality
 * - `useAirJamController()` - For controller functionality
 * - `useGetInput()` - For input access without re-renders
 * - `useSendSignal()` - For sending signals without re-renders
 *
 * @throws Error if used outside of an AirJamProvider
 *
 * @example
 * ```tsx
 * const { config, store, inputManager } = useAirJamContext();
 * ```
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
 * Access the resolved AirJam configuration.
 *
 * Returns the configuration with all environment variable fallbacks resolved.
 *
 * @example
 * ```tsx
 * const config = useAirJamConfig();
 * console.log(config.serverUrl, config.maxPlayers);
 * ```
 */
export const useAirJamConfig = (): AirJamConfig => {
  return useAirJamContext().config;
};

/**
 * Access AirJam store state with a selector.
 *
 * Uses Zustand's useShallow for optimal re-render behavior.
 * Only re-renders when the selected values actually change.
 *
 * @param selector - Function to select state from the store
 * @returns The selected state value
 *
 * @example
 * ```tsx
 * const { players, gameState } = useAirJamState((state) => ({
 *   players: state.players,
 *   gameState: state.gameState,
 * }));
 * ```
 */
export const useAirJamState = <T,>(selector: (state: AirJamStore) => T): T => {
  const { store } = useAirJamContext();
  return useStore(store, useShallow(selector));
};

/**
 * Get a socket instance for the specified role.
 *
 * Returns the same socket instance across renders (stable reference).
 * The socket is managed by the SocketManager and shared across hooks.
 *
 * @param role - Either "host" or "controller"
 * @returns The Socket.IO socket instance
 *
 * @example
 * ```tsx
 * const socket = useAirJamSocket("host");
 * socket.emit("custom:event", { data: "value" });
 * ```
 */
export const useAirJamSocket = (role: ConnectionRole): AirJamSocket => {
  const { getSocket } = useAirJamContext();
  return useMemo(() => getSocket(role), [getSocket, role]);
};

// ============================================================================
// Exports
// ============================================================================

export { AirJamContext };
