/**
 * @module AirJamContext
 * @description Core context and provider for the AirJam SDK.
 *
 * Scoped session providers build on top of this internal provider to enable
 * AirJam functionality. It manages:
 * - WebSocket connections to the AirJam server
 * - Global state via Zustand store
 * - Environment variable resolution for server URLs and app IDs
 *
 * @example Basic Setup
 * ```tsx
 * import { HostSessionProvider } from "@air-jam/sdk";
 *
 * const App = () => (
 *   <HostSessionProvider>
 *     <YourGame />
 *   </HostSessionProvider>
 * );
 * ```
 *
 */
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
import {
  createConnectionStore,
  type AirJamConnectionState,
} from "../core/connection-store";
import { ensureDevBrowserLogSink } from "../dev/browser-log-sink";
import { createAirJamDiagnosticError } from "../diagnostics";
import type { ConnectionRole } from "../protocol";
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import type { HostSessionKind } from "../protocol/host";
import type {
  ResolvedAirJamRuntimeTopology,
  RuntimeTopologyInput,
  SurfaceRole,
} from "../runtime-topology";
import { isLocalDevControlSurfaceTopology } from "../runtime-topology";
import type { AirJamConfig } from "../runtime/air-jam-config";
import { resolveAirJamConfig } from "../runtime/air-jam-config";
import {
  AIRJAM_DEV_PROVIDER_MOUNTED,
  emitAirJamDevRuntimeEvent,
} from "../runtime/dev-runtime-events";
import { embeddedRuntimeParent } from "../runtime/embedded-parent";
import { SocketManager, type AirJamSocket } from "./socket-manager";

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Props for the AirJamProvider component.
 *
 * @example Minimal configuration (uses environment variables)
 * ```tsx
 * <HostSessionProvider>
 *   <App />
 * </HostSessionProvider>
 * ```
 *
 * @example Full configuration
 * ```tsx
 * <HostSessionProvider
 *   topology={myTopology}
 *   appId="your-app-id"
 *   hostGrantEndpoint="/api/airjam/host-grant"
 *   maxPlayers={4}
 * >
 *   <App />
 * </HostSessionProvider>
 * ```
 */
export interface AirJamProviderProps {
  /** React children to render within the provider */
  children: ReactNode;
  /** Explicit runtime topology for this surface. Prefer this over loose endpoint props. */
  topology?: RuntimeTopologyInput | ResolvedAirJamRuntimeTopology;
  /** Internal surface-role hint used while resolving topology. */
  surfaceRole?: SurfaceRole;
  /**
   * App ID for production bootstrap identity.
   * Falls back to VITE_AIR_JAM_APP_ID or NEXT_PUBLIC_AIR_JAM_APP_ID
   * when not provided directly.
   */
  appId?: string;
  /**
   * Optional endpoint that returns a short-lived signed host grant for stronger production bootstrap.
   * When provided, the host runtime fetches a grant automatically before `host:bootstrap`.
   */
  hostGrantEndpoint?: string;
  /**
   * Maximum number of players allowed in a room.
   * @default 8
   */
  maxPlayers?: number;
  /**
   * Declares whether this host provider owns a standalone game room or a system shell room.
   * Standalone games should use `"game"`; Arcade shell hosts should use `"system"`.
   * @default "game"
   */
  hostSessionKind?: HostSessionKind;
  /**
   * Enable environment-variable fallback resolution for config fields.
   * Set to false to require explicit `topology` / `appId` / `hostGrantEndpoint`.
   * @default true
   */
  resolveEnv?: boolean;
}

// ============================================================================
// Context Value
// ============================================================================

export interface AirJamContextValue {
  /** Resolved configuration with env fallbacks */
  config: AirJamConfig;
  /** Context-bound Zustand store */
  store: ReturnType<typeof createConnectionStore>;
  /** Socket manager for this provider instance */
  socketManager: SocketManager;
  /** Get socket for a specific role */
  getSocket: (role: ConnectionRole) => AirJamSocket;
  /** Disconnect socket for a specific role */
  disconnectSocket: (role: ConnectionRole) => void;
}

const AirJamContext = createContext<AirJamContextValue | null>(null);

interface DevProviderMountWindow extends Window {
  __airJamDevProviderMountSent__?: boolean;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Root provider component for the AirJam SDK.
 *
 * Wrap your application (or game component tree) with this provider to enable
 * AirJam functionality. The provider manages WebSocket connections, global state,
 * and the room connection.
 *
 * **Key responsibilities:**
 * - Creates and manages WebSocket connections to the AirJam server
 * - Provides a Zustand store for connection state (players, game state, etc.)
 * - Resolves configuration from props and environment variables
 *
 * @example Basic usage
 * ```tsx
 * import { HostSessionProvider } from "@air-jam/sdk";
 *
 * export const App = () => (
 *   <HostSessionProvider>
 *     <Routes>
 *       <Route path="/" element={<HostView />} />
 *       <Route path="/controller" element={<ControllerView />} />
 *     </Routes>
 *   </HostSessionProvider>
 * );
 * ```
 *
 */
export const AirJamProvider = ({
  children,
  topology,
  surfaceRole,
  appId,
  hostGrantEndpoint,
  maxPlayers,
  hostSessionKind,
  resolveEnv = true,
}: AirJamProviderProps) => {
  // Resolve config via runtime config resolver.
  const config = useMemo<AirJamConfig>(
    () =>
      resolveAirJamConfig({
        topology,
        surfaceRole,
        appId,
        hostGrantEndpoint,
        maxPlayers,
        hostSessionKind,
        resolveEnv,
      }),
    [
      topology,
      surfaceRole,
      appId,
      hostGrantEndpoint,
      maxPlayers,
      hostSessionKind,
      resolveEnv,
    ],
  );
  const localDevControlSurfacesEnabled = useMemo(
    () => isLocalDevControlSurfaceTopology(config.topology),
    [config.topology],
  );

  // Create context-bound store (once per provider)
  const store = useMemo(() => createConnectionStore(), []);

  // Create socket manager (once per provider)
  const socketManager = useMemo(
    () => new SocketManager(config.socketOrigin),
    // Only recreate if socketOrigin changes - intentionally omitting config
    [config.socketOrigin],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const devWindow =
        typeof window !== "undefined"
          ? (window as unknown as DevProviderMountWindow)
          : undefined;
      if (devWindow && localDevControlSurfacesEnabled) {
        try {
          emitAirJamDevRuntimeEvent({
            event: AIRJAM_DEV_LOG_EVENTS.runtime.providerUnmounted,
            level: "info",
            message: "Air Jam provider unmounted",
            data: {
              appId: config.appId,
              backendOrigin: config.backendOrigin,
              socketOrigin: config.socketOrigin,
              href: devWindow.location.href,
              origin: devWindow.location.origin,
              pathname: devWindow.location.pathname,
            },
          });
        } catch {
          // Best effort only
        }
      }
      socketManager.disconnectAll();
    };
  }, [
    config.appId,
    config.backendOrigin,
    config.socketOrigin,
    localDevControlSurfacesEnabled,
    socketManager,
  ]);

  useEffect(() => {
    ensureDevBrowserLogSink({
      appOrigin: config.appOrigin,
      backendOrigin: config.backendOrigin,
      proxyStrategy: config.proxyStrategy,
      appId: config.appId,
      topology: config.topology,
    });

    const devWindow =
      typeof window !== "undefined"
        ? (window as unknown as DevProviderMountWindow)
        : undefined;

    if (
      devWindow &&
      localDevControlSurfacesEnabled &&
      !devWindow.__airJamDevProviderMountSent__
    ) {
      try {
        devWindow.__airJamDevProviderMountSent__ = true;
        emitAirJamDevRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.runtime.providerMounted,
          level: "info",
          message: "Air Jam provider mounted",
          data: {
            appId: config.appId,
            backendOrigin: config.backendOrigin,
            socketOrigin: config.socketOrigin,
            href: devWindow.location.href,
            origin: devWindow.location.origin,
            pathname: devWindow.location.pathname,
          },
        });
        const parent = embeddedRuntimeParent(config.topology);
        if (parent) {
          parent.window.postMessage(
            {
              type: AIRJAM_DEV_PROVIDER_MOUNTED,
              payload: {
                appId: config.appId,
                backendOrigin: config.backendOrigin,
                socketOrigin: config.socketOrigin,
                href: devWindow.location.href,
                origin: devWindow.location.origin,
                pathname: devWindow.location.pathname,
              },
            },
            parent.origin,
          );
        }
      } catch {
        // Best effort only
      }
    }
  }, [
    config.appId,
    config.appOrigin,
    config.backendOrigin,
    config.proxyStrategy,
    config.socketOrigin,
    config.topology,
    localDevControlSurfacesEnabled,
  ]);

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
 * Access the raw AirJam context value.
 *
 * This is a low-level hook that provides direct access to the context.
 * Most applications should use the higher-level hooks instead:
 * - `useAirJamHost()` - For host/game functionality
 * - `useAirJamController()` - For controller functionality
 * - `useSendSignal()` - For sending signals without re-renders
 *
 * @throws Error if used outside of an AirJamProvider
 *
 * @example
 * ```tsx
 * const { config, store } = useAirJamContext();
 * ```
 */
export const useAirJamContext = (): AirJamContextValue => {
  const context = useContext(AirJamContext);
  if (!context) {
    throw createAirJamDiagnosticError(
      "AJ_MISSING_SESSION_PROVIDER",
      "useAirJamContext must be used within a session provider. Wrap your app or component tree with <HostSessionProvider> or <ControllerSessionProvider>.",
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
 * console.log(config.topology.backendOrigin, config.maxPlayers);
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
 * const { players, runtimeState } = useAirJamState((state) => ({
 *   players: state.players,
 *   runtimeState: state.runtimeState,
 * }));
 * ```
 */
export const useAirJamState = <T,>(
  selector: (state: AirJamConnectionState) => T,
): T => {
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

export type { AirJamConfig } from "../runtime/air-jam-config";
export { AirJamContext };
