"use client";

import { arcadeInputSchema } from "@/app/arcade/page";
import { cn } from "@/lib/utils";
import {
  AirJamOverlay,
  type SystemLaunchGameAck,
  urlBuilder,
  useAirJamHost,
} from "@air-jam/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArcadeLoader } from "./arcade-loader";
import { GameBrowser } from "./game-browser";
import { GamePlayer, type GamePlayerGame } from "./game-player";

const DEFAULT_PLATFORM_API_KEY = process.env.NEXT_PUBLIC_PLATFORM_API_KEY;

export type ArcadeGame = GamePlayerGame;

type ArcadeMode = "arcade" | "preview";

interface ArcadeSystemProps {
  games: ArcadeGame[];
  /** The mode determines the UI behavior */
  mode?: ArcadeMode;
  /** Initial game ID to select (used for auto-launch) */
  initialGameId?: string;
  /** Auto-launch the initial game when connected */
  autoLaunch?: boolean;
  /** API key for the platform */
  apiKey?: string;
  /** Custom header content for the browser view */
  header?: React.ReactNode;
  /** Whether to show the exit button overlay on the game player */
  showGameExitOverlay?: boolean;
  /** Initial room ID to use */
  initialRoomId?: string;
  /** Callback when room ID changes */
  onRoomIdChange?: (roomId: string) => void;
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
  apiKey = DEFAULT_PLATFORM_API_KEY,
  header,
  showGameExitOverlay = true,
  initialRoomId,
  onRoomIdChange,
  onExitGame,
  className,
}: ArcadeSystemProps) => {
  // Ref for exit callback (used in onChildClose)
  const exitGameRef = useRef<() => void>(() => {});
  // Ref for launch callback (used in handleInput)
  const launchGameRef = useRef<(game: ArcadeGame) => void>(() => {});

  // State for view & selection
  const [view, setView] = useState<"browser" | "game">(
    mode === "preview" ? "game" : "browser",
  );
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (initialGameId && games.length > 0) {
      const idx = games.findIndex((g) => g.id === initialGameId);
      return idx !== -1 ? idx : 0;
    }
    return 0;
  });
  const [activeGame, setActiveGame] = useState<ArcadeGame | null>(null);
  const [normalizedGameUrl, setNormalizedGameUrl] = useState<string>("");
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const isLaunchingRef = useRef(false);
  // Refs to track current state values for use in callbacks without stale closures
  const activeGameRef = useRef<ArcadeGame | null>(null);
  const joinTokenRef = useRef<string | null>(null);

  // Navigation logic refs
  const lastExitTime = useRef<number>(0);
  const EXIT_COOLDOWN = 500;
  const lastVectorStates = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const host = useAirJamHost<typeof arcadeInputSchema>({
    roomId: initialRoomId,
    apiKey,
    onPlayerJoin: () => {
      // Broadcast will be handled by effect below
    },
    onChildClose: () => {
      console.log("[Arcade] onChildClose callback fired");
      exitGameRef.current();
    },
    forceConnect: true,
  });

  const broadcastCurrentState = useCallback(() => {
    if (!games || games.length === 0) return;
    const currentGame = games[selectedIndex];

    if (view === "browser") {
      host.sendState({
        message: currentGame ? currentGame.name : undefined,
      });
    } else if (view === "game" && activeGame) {
      host.sendState({
        message: activeGame.name,
      });
    }
  }, [games, selectedIndex, view, host, activeGame]);

  // Process input for navigation (polling pattern)
  // Only process input when in browser view (not when game is active)
  useEffect(() => {
    if (
      !host.getInput ||
      !games ||
      games.length === 0 ||
      view !== "browser" ||
      activeGame
    ) {
      return;
    }

    const interval = setInterval(() => {
      // Get input for all connected players
      host.players.forEach((player) => {
        const latchedInput = host.getInput?.(player.id);
        if (!latchedInput) return;

        // Detect edge transitions
        const prevVec = lastVectorStates.current.get(player.id) ?? {
          x: 0,
          y: 0,
        };
        const wasVectorActive =
          Math.abs(prevVec.x) > 0.5 || Math.abs(prevVec.y) > 0.5;
        const isVectorActive =
          Math.abs(latchedInput.vector.x) > 0.5 ||
          Math.abs(latchedInput.vector.y) > 0.5;

        // Navigate on rising edge
        if (isVectorActive && !wasVectorActive) {
          if (latchedInput.vector.y < -0.5) {
            setSelectedIndex((prev) =>
              prev - 1 < 0 ? games.length - 1 : prev - 1,
            );
          } else if (latchedInput.vector.y > 0.5) {
            setSelectedIndex((prev) =>
              prev + 1 >= games.length ? 0 : prev + 1,
            );
          } else if (latchedInput.vector.x < -0.5) {
            setSelectedIndex((prev) =>
              prev - 1 < 0 ? games.length - 1 : prev - 1,
            );
          } else if (latchedInput.vector.x > 0.5) {
            setSelectedIndex((prev) =>
              prev + 1 >= games.length ? 0 : prev + 1,
            );
          }
        }

        lastVectorStates.current.set(player.id, latchedInput.vector);

        // Handle action button
        if (latchedInput.action) {
          const now = Date.now();
          if (now - lastExitTime.current < EXIT_COOLDOWN) return;

          setSelectedIndex((currentIndex) => {
            const game = games[currentIndex];
            if (game) launchGameRef.current(game);
            return currentIndex;
          });
        }
      });
    }, 16); // ~60fps polling

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host.getInput, host.players, games, view, activeGame, joinToken]);

  const launchGame = useCallback(
    async (game: ArcadeGame) => {
      // Prevent launching if already launching, game is active, or joinToken exists
      // Use refs to check current values without stale closures
      if (
        !host.socket ||
        !host.socket.connected ||
        isLaunchingRef.current ||
        activeGameRef.current ||
        joinTokenRef.current
      ) {
        console.log("[Arcade] Launch blocked:", {
          hasSocket: !!host.socket,
          connected: host.socket?.connected,
          isLaunching: isLaunchingRef.current,
          activeGame: !!activeGameRef.current,
          joinToken: !!joinTokenRef.current,
        });
        return;
      }

      console.log("[Arcade] Launching game:", game.name);
      isLaunchingRef.current = true;
      setIsLaunching(true);

      const baseUrl = await urlBuilder.normalizeForMobile(game.url);
      const controllerUrl = `${baseUrl.replace(/\/$/, "")}/joypad`;

      host.socket.emit(
        "system:launchGame",
        {
          roomId: host.roomId,
          gameId: game.id,
          gameUrl: controllerUrl,
        },
        (ack: SystemLaunchGameAck) => {
          isLaunchingRef.current = false;
          setIsLaunching(false);
          if (ack.ok && ack.joinToken) {
            console.log("[Arcade] Game launch successful");
            setJoinToken(ack.joinToken);
            joinTokenRef.current = ack.joinToken;
            setActiveGame(game);
            activeGameRef.current = game;
            setNormalizedGameUrl(baseUrl);
            setView("game");
          } else {
            console.error("[Arcade] Failed to launch game:", ack.message);
          }
        },
      );
    },
    [host.socket, host.roomId],
  );

  const exitGame = useCallback(() => {
    lastExitTime.current = Date.now();

    console.log("[Arcade] Exiting game, clearing state");

    if (host.socket?.connected) {
      host.socket.emit("system:closeGame", { roomId: host.roomId });
    }

    // In preview mode, call the onExitGame callback
    if (mode === "preview") {
      onExitGame?.();
    }

    // Clear state immediately (synchronously with refs)
    setView("browser");
    setActiveGame(null);
    activeGameRef.current = null;
    setNormalizedGameUrl("");
    setJoinToken(null);
    joinTokenRef.current = null;
    isLaunchingRef.current = false;
    setIsLaunching(false);
    // Reset auto-launch flag so game can be launched again if needed
    hasAutoLaunched.current = false;

    console.log("[Arcade] Game exit complete, state cleared");
  }, [host.socket, host.roomId, mode, onExitGame]);

  // Keep refs updated with state
  useEffect(() => {
    activeGameRef.current = activeGame;
  }, [activeGame]);

  useEffect(() => {
    joinTokenRef.current = joinToken;
  }, [joinToken]);

  // Keep refs updated
  useEffect(() => {
    exitGameRef.current = exitGame;
  }, [exitGame]);

  useEffect(() => {
    launchGameRef.current = launchGame;
  }, [launchGame]);

  // Notify parent of room ID changes
  useEffect(() => {
    if (host.roomId && onRoomIdChange) {
      onRoomIdChange(host.roomId);
    }
  }, [host.roomId, onRoomIdChange]);

  // Auto-launch effect (for both arcade and preview modes)
  const hasAutoLaunched = useRef(false);
  const launchGameRefForAutoLaunch = useRef(launchGame);
  useEffect(() => {
    launchGameRefForAutoLaunch.current = launchGame;
  }, [launchGame]);

  useEffect(() => {
    const shouldAutoLaunch = mode === "preview" || autoLaunch;

    // Early return if game is already active, launching, or has joinToken
    if (activeGame || isLaunching || joinToken) {
      return;
    }

    if (
      shouldAutoLaunch &&
      !hasAutoLaunched.current &&
      host.socket?.connected &&
      host.roomId &&
      games.length > 0
    ) {
      const gameToLaunch = initialGameId
        ? games.find((g) => g.id === initialGameId)
        : games[0];

      if (gameToLaunch) {
        console.log(
          "[Arcade] Auto-launching game:",
          gameToLaunch.name,
          "in room:",
          host.roomId,
        );

        hasAutoLaunched.current = true;
        // Use queueMicrotask to avoid synchronous setState in effect warning
        queueMicrotask(() => {
          launchGameRefForAutoLaunch.current(gameToLaunch);
        });
      }
    }
  }, [
    mode,
    autoLaunch,
    initialGameId,
    host.socket?.connected,
    host.roomId,
    games,
    activeGame,
    isLaunching,
    joinToken,
  ]);

  // Broadcast state whenever relevant things change
  useEffect(() => {
    broadcastCurrentState();
  }, [
    view,
    selectedIndex,
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
          "flex h-full items-center justify-center bg-black text-white",
          className,
        )}
      >
        <ArcadeLoader />
      </div>
    );
  }

  // Preview mode: show loading while launching
  if (mode === "preview" && !activeGame && !joinToken) {
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
        {/* Still show the overlay for QR code */}
        <AirJamOverlay />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-slate-950 font-sans text-slate-50",
        className,
      )}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-linear-to-br from-slate-900 to-black" />

      {/* Optional top header */}
      {header && (
        <div className="absolute top-0 right-0 left-0 z-50 p-4">{header}</div>
      )}

      {/* Browser View (only in arcade mode or when game view is hidden) */}
      {mode === "arcade" && (
        <GameBrowser
          games={games}
          selectedIndex={selectedIndex}
          isVisible={view === "browser"}
          onSelectGame={(game, idx) => {
            setSelectedIndex(idx);
            launchGame(game);
          }}
          header={header}
        />
      )}

      {/* Game View */}
      {activeGame && joinToken && (
        <GamePlayer
          game={activeGame}
          normalizedUrl={normalizedGameUrl}
          joinToken={joinToken}
          roomId={host.roomId!}
          isVisible={view === "game"}
          onExit={exitGame}
          showExitOverlay={showGameExitOverlay}
        />
      )}

      {/* Air Jam Overlay */}
      <AirJamOverlay />
    </div>
  );
};
