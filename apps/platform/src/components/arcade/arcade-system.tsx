"use client";

import { cn } from "@/lib/utils";
import { arcadeInputSchema } from "@/lib/airjam-session-config";
import {
  type SystemLaunchGameAck,
  urlBuilder,
  useAirJamHost,
  useHostTick,
} from "@air-jam/sdk";
import { useCallback, useEffect, useRef } from "react";
import { ArcadeChrome } from "./arcade-chrome";
import { ArcadeLoader } from "./arcade-loader";
import { GameBrowser } from "./game-browser";
import {
  EXIT_COOLDOWN_MS,
  shouldAutoLaunchGame,
  useArcadeRuntimeManager,
} from "./arcade-runtime-manager";
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

interface ArcadeSystemProps {
  games: ArcadeGame[];
  /** The mode determines the UI behavior */
  mode?: ArcadeMode;
  /** Initial game ID to select (used for auto-launch) */
  initialGameId?: string;
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
  mode = "arcade",
  initialGameId,
  autoLaunch = false,
  header,
  showGameExitOverlay = true,
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
    activeGame,
    selectedGame,
    moveSelection,
    setSelectedIndex,
    beginLaunch,
    completeLaunch,
    failLaunch,
    exitGame: resetRuntimeAfterExit,
    markAutoLaunched,
  } = runtime;

  // Ref for launch callback (used in input loop)
  const launchGameRef = useRef<(game: ArcadeGame) => void>(() => {});

  // Navigation logic refs
  const EXIT_COOLDOWN = EXIT_COOLDOWN_MS;
  const lastVectorStates = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const lastArcadeInputLogTimeRef = useRef(0);

  const host = useAirJamHost<typeof arcadeInputSchema>({
    onPlayerJoin: () => {
      // Broadcast will be handled by effect below
    },
  });

  const broadcastCurrentState = useCallback(() => {
    if (!games || games.length === 0) return;
    const currentGame = games[state.selectedIndex];

    if (state.view === "browser") {
      host.sendState({
        message: currentGame ? currentGame.name : undefined,
      });
    } else if (state.view === "game" && activeGame) {
      host.sendState({
        message: activeGame.name,
      });
    }
  }, [games, state.selectedIndex, state.view, host, activeGame]);

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
        state.view === "browser" &&
        !activeGame,
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
          activeGame: !!snapshot.activeGameId,
          joinToken: !!snapshot.joinToken,
        });
        return;
      }

      console.log("[Arcade] Launching game:", game.name);

      const baseUrl = await urlBuilder.normalizeForMobile(game.url);
      const controllerUrl = `${baseUrl.replace(/\/$/, "")}/controller`;

      host.socket.emit(
        "system:launchGame",
        {
          roomId: host.roomId,
          gameId: game.id,
          gameUrl: controllerUrl,
        },
        (ack: SystemLaunchGameAck) => {
          if (ack.ok && ack.joinToken) {
            console.log("[Arcade] Game launch successful");
            completeLaunch({
              gameId: game.id,
              joinToken: ack.joinToken,
              normalizedGameUrl: baseUrl,
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
    [host.socket, host.roomId, mode, beginLaunch, stateRef, completeLaunch, failLaunch],
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

    resetRuntimeAfterExit();

    console.log("[Arcade] Game exit complete, state cleared");
  }, [host.socket, host.roomId, mode, resetRuntimeAfterExit]);

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
        mode,
        autoLaunch,
        hasAutoLaunched: state.hasAutoLaunched,
        isConnected: !!host.socket?.connected,
        roomId: host.roomId,
        hasActiveGame: !!activeGame,
        isLaunching: state.isLaunching,
        hasJoinToken: !!state.joinToken,
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

    console.log(
      "[Arcade] Auto-launching game:",
      gameToLaunch.name,
      "in room:",
      host.roomId,
    );

    markAutoLaunched();
    // Use queueMicrotask to avoid synchronous setState in effect warning
    queueMicrotask(() => {
      launchGameRef.current(gameToLaunch);
    });
  }, [
    mode,
    autoLaunch,
    initialGameId,
    state.hasAutoLaunched,
    state.isLaunching,
    state.joinToken,
    host.socket?.connected,
    host.roomId,
    games,
    activeGame,
    markAutoLaunched,
  ]);

  // Broadcast state whenever relevant things change
  useEffect(() => {
    broadcastCurrentState();
  }, [
    state.view,
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

  // Loading state
  if (!games) {
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

  // Preview mode: show loading while launching
  if (mode === "preview" && !activeGame && !state.joinToken) {
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
      {showChrome && (
        <ArcadeChrome
          roomId={host.roomId || undefined}
          players={host.players}
          gameState={host.gameState}
          connectionStatus={host.connectionStatus}
          onTogglePause={host.toggleGameState}
          className="z-40 shrink-0"
        />
      )}

      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden bg-slate-950 font-sans text-slate-50",
        )}
      >
        {/* Background */}
        <div className="absolute inset-0 z-0 bg-black" />
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 z-0 opacity-[0.08]"
          style={{
            background: `linear-gradient(to bottom right, var(--color-airjam-cyan) 0%, var(--color-airjam-magenta) 100%)`,
          }}
        />

        {/* Optional top header */}
        {header && (
          <div className="absolute top-0 right-0 left-0 z-50 p-4">{header}</div>
        )}

        {/* Browser View (only in arcade mode or when game view is hidden) */}
        {mode === "arcade" && (
          <GameBrowser
            games={games}
            selectedIndex={state.selectedIndex}
            isVisible={state.view === "browser"}
            onSelectGame={(game, idx) => {
              setSelectedIndex(idx);
              launchGame(game);
            }}
            header={header}
          />
        )}

        {/* Game View */}
        {activeGame && state.joinToken && (
          <GamePlayer
            game={activeGame}
            normalizedUrl={state.normalizedGameUrl}
            joinToken={state.joinToken}
            roomId={host.roomId!}
            isVisible={state.view === "game"}
            onExit={exitGame}
            showExitOverlay={showGameExitOverlay}
          />
        )}
      </div>
    </div>
  );
};
