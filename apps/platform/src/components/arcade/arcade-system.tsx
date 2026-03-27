"use client";

import { arcadeInputSchema } from "@/lib/airjam-session-config";
import { cn } from "@/lib/utils";
import { useAirJamHost, useHostTick } from "@air-jam/sdk";
import { airJamArcadePlatformActions } from "@air-jam/sdk/protocol";
import type {
  AirJamActionRpcPayload,
  SystemLaunchGameAck,
} from "@air-jam/sdk/protocol";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
} from "@air-jam/sdk/arcade/surface";
import { useHostArcadeRestore } from "@air-jam/sdk/arcade/host";
import {
  normalizeRuntimeUrl,
  urlBuilder,
} from "@air-jam/sdk/arcade/url";
import { RoomQrCode } from "@air-jam/sdk/ui";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArcadeChrome } from "./arcade-chrome";
import { ArcadeLoader } from "./arcade-loader";
import {
  EXIT_COOLDOWN_MS,
  getAutoLaunchRequestKey,
  shouldAutoLaunchGame,
  useArcadeRuntimeManager,
} from "./arcade-runtime-manager";
import { useArcadeSurfaceStore } from "./arcade-surface-store";
import { GameBrowser } from "./game-browser";
import { GamePlayer, type GamePlayerGame } from "./game-player";

// Calculate grid columns based on window width
const getGridColumns = (): number => {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth >= 1024) return 3; // lg
  if (window.innerWidth >= 768) return 2; // md
  return 1; // sm
};

export type ArcadeGame = GamePlayerGame & { slug?: string | null };

type ArcadeMode = "arcade" | "preview";
type ArcadeHostRouteIntent =
  | { kind: "browser" }
  | { kind: "game"; gameId: string | null };

/** Pixel size for the join QR in the full-screen overlay (below arcade chrome). */
const ARCADE_QR_OVERLAY_SIZE = 260;

/** Top padding for game browser so content clears the overlaid chrome bar (~py-2 + logo/room row). */
const ARCADE_BROWSER_CHROME_GUTTER_PT = "pt-14";

const ARCADE_QR_OVERLAY_MOTION_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1] as const,
};

interface ArcadeSystemProps {
  games: ArcadeGame[];
  /**
   * When false, the public game catalog is still loading — do not drop
   * the pending host reconnect restore session during hydration; apply once the matching game
   * entry exists.
   */
  gamesCatalogReady?: boolean;
  /** The mode determines the UI behavior */
  mode?: ArcadeMode;
  /** Initial game ID to select (used for auto-launch) */
  initialGameId?: string;
  /** Host URL intent on boot/reconnect: bare `/arcade` means browser; `/arcade/[slug]` means target that game. */
  hostRouteIntent?: ArcadeHostRouteIntent;
  /** Auto-launch the initial game when connected */
  autoLaunch?: boolean;
  /** Custom header content for the browser view */
  header?: React.ReactNode;
  /** Whether to show the exit button overlay on the game player */
  showGameExitOverlay?: boolean;
  /** Whether to show the platform chrome/navbar */
  showChrome?: boolean;
  /** Callback when exiting a game (preview mode) */
  onExitGame?: () => void;
  /** Custom class name for the container */
  className?: string;
}

/**
 * The main arcade system component.
 *
 * In "arcade" mode: Shows a game browser where users can navigate and select games.
 * In "preview" mode: Immediately launches the first/specified game, skipping the browser.
 */
export const ArcadeSystem = ({
  games,
  gamesCatalogReady = true,
  mode = "arcade",
  initialGameId,
  hostRouteIntent = { kind: "browser" },
  autoLaunch = false,
  header,
  showGameExitOverlay = false,
  showChrome = mode === "arcade",
  onExitGame,
  className,
}: ArcadeSystemProps) => {
  const runtime = useArcadeRuntimeManager({
    games,
    mode,
    initialGameId,
    onExitGame,
  });
  const {
    state,
    stateRef,
    selectedGame,
    moveSelection,
    setSelectedIndex,
    beginLaunch,
    completeLaunch,
    failLaunch,
    resetSession,
    exitGame: resetRuntimeAfterExit,
    consumeAutoLaunch,
  } = runtime;

  // Ref for launch callback (used in input loop)
  const launchGameRef = useRef<(game: ArcadeGame) => void>(() => {});

  // Navigation logic refs
  const EXIT_COOLDOWN = EXIT_COOLDOWN_MS;
  const lastVectorStates = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const lastArcadeInputLogTimeRef = useRef(0);
  /** Scroll position for chrome styling only; not part of surface authority. */
  const [browserListAtTop, setBrowserListAtTop] = useState(true);

  const qrVisible = useArcadeSurfaceStore((s) => s.overlay === "qr");
  const surfaceKind = useArcadeSurfaceStore((s) => s.kind);
  const arcadeSurfaceRuntimeIdentity = useArcadeSurfaceStore(
    useShallow((s) => ({
      epoch: s.epoch,
      kind: s.kind,
      gameId: s.gameId,
    })),
  );
  const activeGame = useMemo(
    () =>
      arcadeSurfaceRuntimeIdentity.gameId
        ? (games.find(
            (game) => game.id === arcadeSurfaceRuntimeIdentity.gameId,
          ) ?? null)
        : null,
    [games, arcadeSurfaceRuntimeIdentity.gameId],
  );
  const surfaceActions = useArcadeSurfaceStore.useActions();
  const lastRoomIdForSurfaceRef = useRef<string | null>(null);
  const hostArcadeRestore = useHostArcadeRestore();
  const pendingHostArcadeRestoreSession = hostArcadeRestore.session;

  const host = useAirJamHost<typeof arcadeInputSchema>({
    onPlayerJoin: () => {
      // Broadcast will be handled by effect below
    },
  });

  const arcadeJoinUrl = useMemo(() => {
    if (host.joinUrl) {
      return host.joinUrl;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host.joinUrl, host.roomId]);

  const joinQrStatus = host.joinUrlStatus;
  const autoLaunchRequestKey = useMemo(
    () => getAutoLaunchRequestKey({ mode, autoLaunch, initialGameId }),
    [mode, autoLaunch, initialGameId],
  );

  useEffect(() => {
    if (!host.roomId || !host.socket?.connected) {
      return;
    }
    if (lastRoomIdForSurfaceRef.current === host.roomId) {
      return;
    }

    const previousRoomId = lastRoomIdForSurfaceRef.current;
    lastRoomIdForSurfaceRef.current = host.roomId;
    resetSession();

    if (previousRoomId !== null && previousRoomId !== host.roomId) {
      surfaceActions.resetHostSurfaceForMode({ mode });
      return;
    }

    if (hostArcadeRestore.phase === "pending_restore") {
      return;
    }

    surfaceActions.resetHostSurfaceForMode({ mode });
  }, [
    host.roomId,
    host.socket?.connected,
    mode,
    resetSession,
    surfaceActions,
    hostArcadeRestore.phase,
  ]);

  useEffect(() => {
    if (!host.roomId || !host.socket?.connected) {
      return;
    }
    if (!pendingHostArcadeRestoreSession) {
      return;
    }

    let cancelled = false;

    const restoreArcadeSession = async (): Promise<void> => {
      const snap = pendingHostArcadeRestoreSession;
      if (!snap) {
        return;
      }

      if (hostRouteIntent.kind === "browser") {
        host.socket.emit("system:closeGame", { roomId: host.roomId });
        hostArcadeRestore.clear();
        return;
      }

      if (hostRouteIntent.kind === "game" && hostRouteIntent.gameId) {
        if (snap.gameId !== hostRouteIntent.gameId) {
          host.socket.emit("system:closeGame", { roomId: host.roomId });
          hostArcadeRestore.clear();
          return;
        }
      }

      const game = games.find((g) => g.id === snap.gameId) ?? null;

      if (!game) {
        if (!gamesCatalogReady) {
          return;
        }
        hostArcadeRestore.clear();
        return;
      }

      const normalizedHostUrl = normalizeRuntimeUrl(game.url);
      if (!normalizedHostUrl) {
        hostArcadeRestore.clear();
        return;
      }

      const mobileControllerBaseUrl =
        await urlBuilder.normalizeForMobile(normalizedHostUrl);
      const controllerUrl = `${mobileControllerBaseUrl.replace(/\/$/, "")}/controller`;

      if (cancelled) {
        return;
      }

      surfaceActions.setGameSurface({
        gameId: game.id,
        controllerUrl,
        orientation: "landscape",
      });
      surfaceActions.setOverlay({ overlay: "hidden" });

      completeLaunch({
        normalizedGameUrl: normalizedHostUrl,
        launchCapability: snap.launchCapability,
      });

      const idx = games.findIndex((g) => g.id === game.id);
      if (idx >= 0) {
        setSelectedIndex(idx);
      }

      if (mode === "arcade" && typeof window !== "undefined") {
        const gameSlugOrId = game.slug || game.id;
        window.history.replaceState(null, "", `/arcade/${gameSlugOrId}`);
      }

      hostArcadeRestore.clear();
    };

    void restoreArcadeSession();

    return () => {
      cancelled = true;
    };
  }, [
    host.roomId,
    host.socket?.connected,
    pendingHostArcadeRestoreSession,
    hostRouteIntent,
    games,
    gamesCatalogReady,
    mode,
    completeLaunch,
    surfaceActions,
    hostArcadeRestore,
    setSelectedIndex,
    host.socket,
  ]);

  const broadcastCurrentState = useCallback(() => {
    if (!games || games.length === 0) return;
    const currentGame = games[state.selectedIndex];

    if (surfaceKind === "browser") {
      host.sendState({
        message: currentGame ? currentGame.name : undefined,
      });
    } else if (surfaceKind === "game" && activeGame) {
      host.sendState({
        message: activeGame.name,
      });
    }
  }, [games, state.selectedIndex, surfaceKind, host, activeGame]);

  // Canonical host polling loop for browser navigation.
  useHostTick(
    () => {
      host.players.forEach((player) => {
        const latchedInput = host.getInput?.(player.id);
        if (!latchedInput) return;

        const now = Date.now();
        const hasActiveInput =
          latchedInput.action === true ||
          (latchedInput.vector &&
            (Math.abs(latchedInput.vector.x) > 0.01 ||
              Math.abs(latchedInput.vector.y) > 0.01));
        if (
          hasActiveInput &&
          (!lastArcadeInputLogTimeRef.current ||
            now - lastArcadeInputLogTimeRef.current > 1000)
        ) {
          lastArcadeInputLogTimeRef.current = now;
        }

        const prevVec = lastVectorStates.current.get(player.id) ?? {
          x: 0,
          y: 0,
        };
        const wasVectorActive =
          Math.abs(prevVec.x) > 0.5 || Math.abs(prevVec.y) > 0.5;
        const isVectorActive =
          Math.abs(latchedInput.vector.x) > 0.5 ||
          Math.abs(latchedInput.vector.y) > 0.5;

        if (isVectorActive && !wasVectorActive) {
          moveSelection(latchedInput.vector, getGridColumns());
        }

        lastVectorStates.current.set(player.id, latchedInput.vector);

        if (latchedInput.action) {
          if (now - stateRef.current.lastExitAt < EXIT_COOLDOWN) return;
          const game = games[stateRef.current.selectedIndex] ?? selectedGame;
          if (game) {
            launchGameRef.current(game);
          }
        }
      });
    },
    {
      enabled:
        !!host.getInput &&
        games.length > 0 &&
        mode === "arcade" &&
        surfaceKind === "browser",
      mode: "interval",
      intervalMs: 16,
    },
  );

  const launchGame = useCallback(
    async (game: ArcadeGame) => {
      if (!host.socket || !host.socket.connected) {
        console.log("[Arcade] Launch blocked:", {
          hasSocket: !!host.socket,
          connected: host.socket?.connected,
        });
        return;
      }

      if (!beginLaunch()) {
        const snapshot = stateRef.current;
        console.log("[Arcade] Launch blocked:", {
          hasSocket: !!host.socket,
          connected: host.socket?.connected,
          isLaunching: snapshot.isLaunching,
          hasLaunchCapability: !!snapshot.launchCapability,
          surfaceKind,
        });
        return;
      }

      console.log("[Arcade] Launching game:", game.name);

      const normalizedHostUrl = normalizeRuntimeUrl(game.url);
      if (!normalizedHostUrl) {
        failLaunch();
        console.error("[Arcade] Failed to launch game: invalid game URL", {
          gameId: game.id,
          gameUrl: game.url,
        });
        return;
      }

      const mobileControllerBaseUrl =
        await urlBuilder.normalizeForMobile(normalizedHostUrl);
      const controllerUrl = `${mobileControllerBaseUrl.replace(/\/$/, "")}/controller`;

      host.socket.emit(
        "system:launchGame",
        {
          roomId: host.roomId,
          gameId: game.id,
        },
        (ack: SystemLaunchGameAck) => {
          if (ack.ok && ack.launchCapability) {
            console.log("[Arcade] Game launch successful");
            surfaceActions.setGameSurface({
              gameId: game.id,
              controllerUrl: controllerUrl,
              orientation: "landscape",
            });
            surfaceActions.setOverlay({ overlay: "hidden" });
            completeLaunch({
              launchCapability: ack.launchCapability,
              normalizedGameUrl: normalizedHostUrl,
            });

            // Update URL shallowly in arcade mode for deep linking
            if (mode === "arcade" && typeof window !== "undefined") {
              const gameSlugOrId = game.slug || game.id;
              window.history.replaceState(null, "", `/arcade/${gameSlugOrId}`);
            }
          } else {
            failLaunch();
            console.error("[Arcade] Failed to launch game:", ack.message);
          }
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      arcadeJoinUrl,
      host.socket,
      host.roomId,
      mode,
      beginLaunch,
      stateRef,
      completeLaunch,
      failLaunch,
      surfaceActions,
    ],
  );

  const exitGame = useCallback(() => {
    console.log("[Arcade] Exiting game, clearing state");

    if (host.socket?.connected) {
      host.socket.emit("system:closeGame", { roomId: host.roomId });
    }

    // Reset URL shallowly in arcade mode
    if (mode === "arcade" && typeof window !== "undefined") {
      window.history.replaceState(null, "", "/arcade");
    }

    surfaceActions.setBrowserSurface();
    surfaceActions.setOverlay({
      overlay: mode === "arcade" ? "qr" : "hidden",
    });
    resetRuntimeAfterExit();

    console.log("[Arcade] Game exit complete, state cleared");
  }, [host.socket, host.roomId, mode, resetRuntimeAfterExit, surfaceActions]);

  const handleArcadeAction = useCallback(
    (event: AirJamActionRpcPayload) => {
      if (event.storeDomain !== AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN) {
        return;
      }
      switch (event.actionName) {
        case airJamArcadePlatformActions.toggleQr:
          surfaceActions.toggleQrOverlay();
          return;
        case airJamArcadePlatformActions.showQr:
          surfaceActions.setOverlay({ overlay: "qr" });
          return;
        case airJamArcadePlatformActions.hideQr:
          surfaceActions.setOverlay({ overlay: "hidden" });
          return;
        case airJamArcadePlatformActions.exitGame:
          if (surfaceKind === "game") {
            exitGame();
          }
          return;
        default:
          return;
      }
    },
    [exitGame, surfaceKind, surfaceActions],
  );

  useEffect(() => {
    if (!host.socket) {
      return;
    }

    host.socket.on("airjam:action_rpc", handleArcadeAction);
    return () => {
      host.socket?.off("airjam:action_rpc", handleArcadeAction);
    };
  }, [host.socket, handleArcadeAction]);

  useEffect(() => {
    launchGameRef.current = launchGame;
  }, [launchGame]);

  // Platform-owned child-host lifecycle event.
  useEffect(() => {
    const handleChildClose = () => {
      console.log("[Arcade] server:closeChild received");
      exitGame();
    };

    host.socket.on("server:closeChild", handleChildClose);
    return () => {
      host.socket.off("server:closeChild", handleChildClose);
    };
  }, [host.socket, exitGame]);

  // Auto-launch effect (for both arcade and preview modes)
  useEffect(() => {
    if (
      !shouldAutoLaunchGame({
        autoLaunchRequestKey,
        consumedAutoLaunchRequestKey: state.consumedAutoLaunchRequestKey,
        isConnected: !!host.socket?.connected,
        roomId: host.roomId,
        surfaceKind,
        isLaunching: state.isLaunching,
        hasLaunchCapability: !!state.launchCapability,
        gamesLength: games.length,
      })
    ) {
      return;
    }

    const gameToLaunch = initialGameId
      ? games.find((game) => game.id === initialGameId)
      : games[0];

    if (!gameToLaunch) {
      return;
    }
    if (!autoLaunchRequestKey) {
      return;
    }

    console.log(
      "[Arcade] Auto-launching game:",
      gameToLaunch.name,
      "in room:",
      host.roomId,
    );

    consumeAutoLaunch(autoLaunchRequestKey);
    // Use queueMicrotask to avoid synchronous setState in effect warning
    queueMicrotask(() => {
      launchGameRef.current(gameToLaunch);
    });
  }, [
    autoLaunchRequestKey,
    initialGameId,
    state.consumedAutoLaunchRequestKey,
    state.isLaunching,
    state.launchCapability,
    host.socket?.connected,
    host.roomId,
    games,
    surfaceKind,
    consumeAutoLaunch,
  ]);

  // Broadcast state whenever relevant things change
  useEffect(() => {
    broadcastCurrentState();
  }, [
    surfaceKind,
    state.selectedIndex,
    games,
    host.connectionStatus,
    broadcastCurrentState,
  ]);

  // Broadcast when player joins
  useEffect(() => {
    if (host.players.length > 0) {
      broadcastCurrentState();
    }
  }, [host.players.length, broadcastCurrentState]);

  // Loading state while the public game catalog is not ready.
  if (!gamesCatalogReady || !games) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-black text-white",
          className,
        )}
      >
        <ArcadeLoader />
      </div>
    );
  }

  const isBrowserChromeVisible = showChrome && surfaceKind === "browser";

  // Preview mode: show loading until surface is game with a join token (launch + hydration)
  if (mode === "preview" && surfaceKind === "browser" && !state.launchCapability) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center bg-slate-950 text-white",
          className,
        )}
      >
        <div className="absolute inset-0">
          <ArcadeLoader />
        </div>
        <div className="z-10 flex flex-col items-center gap-4 pt-40">
          <span className="text-airjam-cyan animate-pulse font-mono tracking-widest">
            CONNECTING TO AIR JAM...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-slate-950 font-sans text-slate-50",
        className,
      )}
    >
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden bg-slate-950 font-sans text-slate-50",
        )}
      >
        {/* Base — near-black void */}
        <div className="absolute inset-0 z-0 bg-[#050508]" />
        {/* Soft ambient glows (no full-screen color wash) */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: `radial-gradient(ellipse 110% 75% at 50% -18%, color-mix(in srgb, var(--color-airjam-cyan) 16%, transparent), transparent 58%)`,
          }}
        />
        {/* Micro grid, vignette-faded for a sleek HUD feel */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            opacity: 0.45,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 88% 78% at 50% 42%, black 22%, transparent 72%)",
          }}
        />

        {isBrowserChromeVisible && (
          <ArcadeChrome
            roomId={host.roomId || undefined}
            players={host.players}
            connectionStatus={host.connectionStatus}
            lastError={host.lastError}
            qrVisible={qrVisible}
            onToggleQr={() => surfaceActions.toggleQrOverlay()}
            listAtTop={browserListAtTop}
            className="absolute top-0 right-0 left-0 z-60"
          />
        )}

        {/* Optional top header */}
        {header && (
          <div className="absolute top-0 right-0 left-0 z-70 p-4">{header}</div>
        )}

        <AnimatePresence>
          {qrVisible && (
            <motion.div
              key="arcade-join-qr-overlay"
              role="dialog"
              aria-modal="true"
              aria-label={
                host.roomId
                  ? `Join room ${host.roomId}`
                  : "Scan QR code to join as controller"
              }
              className="absolute inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-black/85 px-6 backdrop-blur-md"
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={ARCADE_QR_OVERLAY_MOTION_TRANSITION}
              onClick={() => surfaceActions.setOverlay({ overlay: "hidden" })}
            >
              <div
                className="flex cursor-default flex-col items-center gap-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
                    Join room
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-white tabular-nums">
                    {host.roomId || "----"}
                  </p>
                </div>
                {joinQrStatus === "loading" ? (
                  <div
                    className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/25 bg-white/6 text-sm text-white/70 shadow-sm"
                    style={{
                      width: ARCADE_QR_OVERLAY_SIZE,
                      height: ARCADE_QR_OVERLAY_SIZE,
                    }}
                  >
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/85" />
                    <span>Preparing join QR…</span>
                  </div>
                ) : arcadeJoinUrl ? (
                  <RoomQrCode
                    value={arcadeJoinUrl}
                    size={ARCADE_QR_OVERLAY_SIZE}
                    padding={2}
                    foregroundColor="#111827"
                    backgroundColor="#ffffff"
                    alt="QR code to join this room as a controller"
                    className="rounded-lg border border-white/25 bg-white/6 shadow-sm"
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-lg border border-white/25 bg-white/6 text-sm text-white/70 shadow-sm"
                    style={{
                      width: ARCADE_QR_OVERLAY_SIZE,
                      height: ARCADE_QR_OVERLAY_SIZE,
                    }}
                  >
                    {joinQrStatus === "unavailable"
                      ? "QR unavailable"
                      : "Preparing join QR…"}
                  </div>
                )}
                <p className="max-w-xs text-center text-sm text-slate-400">
                  Scan with your phone to connect as a controller
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={cn(
            "absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden",
            isBrowserChromeVisible && ARCADE_BROWSER_CHROME_GUTTER_PT,
          )}
        >
          {/* Browser View (only in arcade mode or when game view is hidden) */}
          {mode === "arcade" && (
            <GameBrowser
              games={games}
              selectedIndex={state.selectedIndex}
              isVisible={surfaceKind === "browser"}
              onSelectGame={(game, idx) => {
                setSelectedIndex(idx);
                launchGame(game);
              }}
              header={header}
              onScrollTopChange={setBrowserListAtTop}
            />
          )}
        </div>

        {/* Game View — surface kind is authoritative for shell; runtime holds iframe credentials */}
        {surfaceKind === "game" && activeGame && state.launchCapability && (
          joinQrStatus === "loading" ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black text-sm font-medium text-white/80">
              Preparing game…
            </div>
          ) : (
            <GamePlayer
              game={activeGame}
              normalizedUrl={state.normalizedGameUrl}
              launchCapability={state.launchCapability}
              roomId={host.roomId!}
              joinUrl={joinQrStatus === "ready" ? arcadeJoinUrl : null}
              hostSocket={host.socket}
              players={host.players}
              gameState={host.gameState}
              isVisible={surfaceKind === "game"}
              arcadeSurfaceRuntimeIdentity={arcadeSurfaceRuntimeIdentity}
              onExit={exitGame}
              showExitOverlay={showGameExitOverlay}
            />
          )
        )}
      </div>
    </div>
  );
};
