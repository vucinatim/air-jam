/**
 * @module AirJamContext
 * @description Core context and provider for the AirJam SDK.
 *
 * Scoped session providers build on top of this internal provider to enable
 * AirJam functionality. It manages:
 * - The connection state of the surface's room via a Zustand store
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
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import type { RuntimeErrorReporter } from "../protocol/runtime-reporting";
import type {
  ResolvedAirJamRuntimeTopology,
  RuntimeTopologyInput,
  SurfaceRole,
} from "../runtime-topology";
import { isLocalDevControlSurfaceTopology } from "../runtime-topology";
import type { AirJamConfig } from "../runtime/air-jam-config";
import { resolveAirJamConfig } from "../runtime/air-jam-config";
import { isAirJamReplayDocument } from "../runtime/browser-replay";
import {
  AIRJAM_DEV_PROVIDER_MOUNTED,
  emitAirJamDevRuntimeEvent,
} from "../runtime/dev-runtime-events";
import { embeddedRuntimeParent } from "../runtime/embedded-parent";

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
   * Optional endpoint that returns a short-lived signed host grant. When
   * provided, the host fetches a fresh grant for each room it opens and
   * gives it to the room server as its credential.
   */
  hostGrantEndpoint?: string;
  /**
   * Maximum number of players allowed in a room.
   * @default 8
   */
  maxPlayers?: number;
  /**
   * Where runtime error reports go, such as a hosted platform's own route.
   * Without one they go to the development log.
   */
  reportError?: RuntimeErrorReporter;
  /**
   * The channel the host publishes its presentation (paused or playing, how
   * phones are held) on. A launcher that embeds games passes its own, so the
   * game it runs keeps the default.
   */
  presentationChannel?: string;
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
 * AirJam functionality. The provider resolves the surface's configuration and
 * holds its connection state; the runtimes open the room.
 *
 * **Key responsibilities:**
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
  reportError,
  presentationChannel,
  resolveEnv = true,
}: AirJamProviderProps) => {
  // Resolve config via runtime config resolver.
  const config = useMemo<AirJamConfig>(
    () =>
      resolveAirJamConfig(
        {
          topology,
          surfaceRole,
          appId,
          hostGrantEndpoint,
          reportError,
          presentationChannel,
          resolveEnv,
        },
        maxPlayers,
      ),
    [
      topology,
      surfaceRole,
      appId,
      hostGrantEndpoint,
      maxPlayers,
      reportError,
      presentationChannel,
      resolveEnv,
    ],
  );
  const localDevControlSurfacesEnabled = useMemo(
    () =>
      isLocalDevControlSurfaceTopology(config.topology) &&
      !isAirJamReplayDocument(),
    [config.topology],
  );

  // Create context-bound store (once per provider)
  const store = useMemo(() => createConnectionStore(), []);

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
    };
  }, [
    config.appId,
    config.backendOrigin,
    config.socketOrigin,
    localDevControlSurfacesEnabled,
  ]);

  useEffect(() => {
    if (isAirJamReplayDocument()) return;
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

  const contextValue = useMemo<AirJamContextValue>(
    () => ({ config, store }),
    [config, store],
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

// ============================================================================
// Exports
// ============================================================================

export type { AirJamConfig } from "../runtime/air-jam-config";
export { AirJamContext };
