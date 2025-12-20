"use client";

import { cn } from "@/lib/utils";
import {
  AirJamOverlay,
  type ControllerInputEvent,
  type SystemLaunchGameAck,
  urlBuilder,
  useAirJamHost,
  useAirJamInput,
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
  // Input type for arcade navigation
  type ArcadeInput = {
    vector: { x: number; y: number };
    action: boolean;
  };

  // Set up input handle for responsive navigation
  const { getController, clearInput } = useAirJamInput<ArcadeInput>(); // Changed from useAirJamInputLatch

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

  // Navigation logic refs
  const lastExitTime = useRef<number>(0);
  const EXIT_COOLDOWN = 500;

  const handleInput = useCallback(
    (event: ControllerInputEvent) => {
      const { controllerId } = event;

      // Only handle navigation in browser view
      if (!games || games.length === 0) {
        return;
      }

      // Get the intelligent controller handle
      const controller = getController(controllerId);
      if (!controller) return;

      // Handle system commands (Pause/Play) if the action was just pressed
      if (controller.justPressed("action")) {
        // Toggle game state or confirm selection
      }

      // Exit logic for when in game view
      if (view === "game") {
        if (controller.isDown("action")) {
          const now = Date.now();
          if (now - lastExitTime.current > EXIT_COOLDOWN) {
            // Logic for exiting...
          }
        }
        return;
      }

      // Browser navigation logic
      const vector = controller.vector("vector");

      if (vector.y < -0.5) {
        setSelectedIndex((prev) =>
          prev - 1 < 0 ? games.length - 1 : prev - 1,
        );
      } else if (vector.y > 0.5) {
        setSelectedIndex((prev) => (prev + 1 >= games.length ? 0 : prev + 1));
      } else if (vector.x < -0.5) {
        setSelectedIndex((prev) =>
          prev - 1 < 0 ? games.length - 1 : prev - 1,
        );
      } else if (vector.x > 0.5) {
        setSelectedIndex((prev) => (prev + 1 >= games.length ? 0 : prev + 1));
      }

      // Handle action button
      if (controller.justPressed("action")) { // Changed from actionLatched
        const now = Date.now();
        if (now - lastExitTime.current < EXIT_COOLDOWN) return;

        setSelectedIndex((currentIndex) => {
          const game = games[currentIndex];
          if (game) launchGameRef.current(game);
          return currentIndex;
        });
      }
    },
    [games, getController],
  );

  const host = useAirJamHost({
    roomId: initialRoomId,
    onInput: handleInput,
    onPlayerJoin: () => {
      broadcastCurrentState();
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

  const launchGame = useCallback(
    async (game: ArcadeGame) => {
      if (!host.socket || !host.socket.connected || isLaunching) {
        return;
      }

      console.log("[Arcade] Launching game:", game.name);
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
          setIsLaunching(false);
          if (ack.ok && ack.joinToken) {
            console.log("[Arcade] Game launch successful");
            setJoinToken(ack.joinToken);
            setActiveGame(game);
            setNormalizedGameUrl(baseUrl);
            setView("game");
          } else {
            console.error("[Arcade] Failed to launch game:", ack.message);
          }
        },
      );
    },
    [host.socket, host.roomId, isLaunching],
  );

  const exitGame = useCallback(() => {
    lastExitTime.current = Date.now();

    if (host.socket?.connected) {
      host.socket.emit("system:closeGame", { roomId: host.roomId });
    }

    // In preview mode, call the onExitGame callback
    if (mode === "preview") {
      onExitGame?.();
    }

    setView("browser");
    setActiveGame(null);
    setNormalizedGameUrl("");
    setJoinToken(null);
  }, [host.socket, host.roomId, mode, onExitGame]);

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
  useEffect(() => {
    const shouldAutoLaunch = mode === "preview" || autoLaunch;

    if (
      shouldAutoLaunch &&
      !hasAutoLaunched.current &&
      host.socket?.connected &&
      host.roomId &&
      games.length > 0 &&
      !activeGame
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
          launchGame(gameToLaunch);
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
    launchGame,
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
        <AirJamOverlay {...host} onTogglePlayPause={host.toggleGameState} />
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
      <AirJamOverlay {...host} onTogglePlayPause={host.toggleGameState} />
    </div>
  );
};
