"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import {
  AirJamOverlay,
  type ControllerInputEvent,
  type SystemLaunchGameAck,
  urlBuilder,
  useAirJamHost,
} from "@air-jam/sdk";
import { Gamepad2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Placeholder for the Platform's own API Key.
// In a real app, you might fetch this or use a specific "Platform" key.
const PLATFORM_API_KEY = process.env.NEXT_PUBLIC_PLATFORM_API_KEY;

export default function ArcadePage() {
  // 0. Persist Room ID for Development convenience
  const [persistedRoomId] = useState(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("airjam_platform_room_id") || undefined;
    }
    return undefined;
  });

  // 1. Initialize the Host (The Platform is the Host)
  const exitGameRef = useRef<() => void>(() => {});

  const host = useAirJamHost({
    roomId: persistedRoomId,
    apiKey: PLATFORM_API_KEY,
    onInput: (event) => handleInput(event),
    onPlayerJoin: () => {
      // Re-broadcast state when new player joins
      broadcastCurrentState();
    },
    onChildClose: () => {
      console.log(
        "[Arcade] ========== onChildClose CALLBACK FIRED ==========",
        {
          currentView: view,
          currentActiveGame: activeGame?.id,
        },
      );
      exitGameRef.current();
    },
    forceConnect: true,
  });

  // Save room ID when it changes
  useEffect(() => {
    if (host.roomId && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("airjam_platform_room_id", host.roomId);
    }
  }, [host.roomId]);

  // 2. State for Navigation & Game Launching
  const [view, setView] = useState<"browser" | "game">("browser");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeGame, setActiveGame] = useState<{
    id: string;
    name: string;
    url: string;
  } | null>(null);
  const [normalizedGameUrl, setNormalizedGameUrl] = useState<string>("");
  const [joinToken, setJoinToken] = useState<string | null>(null);

  // Fetch games (assuming you have games in your DB)
  const { data: games } = api.game.list.useQuery();

  // Helper to sync state to controllers
  const broadcastCurrentState = () => {
    if (!games) return;
    const currentGame = games[selectedIndex];

    // We only broadcast "browser" state. When game launches, Server handles UI switching.
    if (view === "browser") {
      host.sendState({
        gameState: "paused",
        message: currentGame ? currentGame.name : undefined,
      });
    }
  };

  // Broadcast state whenever relevant things change
  useEffect(() => {
    console.log("[Arcade] broadcastCurrentState useEffect triggered", {
      view,
      selectedIndex,
      gamesLength: games?.length,
      connectionStatus: host.connectionStatus,
    });
    broadcastCurrentState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedIndex, games, host.connectionStatus]);

  // 3. Navigation Logic
  const lastInputTime = useRef<number>(0);
  const lastExitTime = useRef<number>(0);
  const INPUT_DEBOUNCE = 200; // ms
  const EXIT_COOLDOWN = 500; // ms - prevent immediate relaunch after exit

  const handleInput = (event: ControllerInputEvent) => {
    const { input } = event;
    // Only handle navigation if we are in the browser view
    if (view !== "browser" || !games || games.length === 0) {
      return;
    }
    const now = Date.now();

    // Type guards for safe extraction
    // Arcade expects gamepad pattern: { vector: {x, y}, action: boolean }
    const getVector = (): { x: number; y: number } | null => {
      if (
        input.vector &&
        typeof input.vector === "object" &&
        !Array.isArray(input.vector) &&
        typeof (input.vector as { x?: unknown }).x === "number" &&
        typeof (input.vector as { y?: unknown }).y === "number"
      ) {
        return input.vector as { x: number; y: number };
      }
      return null;
    };

    const getAction = (): boolean => {
      return typeof input.action === "boolean" ? input.action : false;
    };

    const vector = getVector();

    if (now - lastInputTime.current > INPUT_DEBOUNCE && vector) {
      if (vector.y < -0.5) {
        // Up (Previous)
        setSelectedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? games.length - 1 : next;
        });
        lastInputTime.current = now;
      } else if (vector.y > 0.5) {
        // Down (Next)
        setSelectedIndex((prev) => {
          const next = prev + 1;
          return next >= games.length ? 0 : next;
        });
        lastInputTime.current = now;
      } else if (vector.x < -0.5) {
        // Left (Previous)
        setSelectedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? games.length - 1 : next;
        });
        lastInputTime.current = now;
      } else if (vector.x > 0.5) {
        // Right (Next)
        setSelectedIndex((prev) => {
          const next = prev + 1;
          return next >= games.length ? 0 : next;
        });
        lastInputTime.current = now;
      }
    }

    if (getAction()) {
      // Check if we're still in cooldown after exiting a game
      if (now - lastExitTime.current < EXIT_COOLDOWN) {
        console.log("[Arcade] Action button ignored - exit cooldown active", {
          timeSinceExit: now - lastExitTime.current,
          cooldown: EXIT_COOLDOWN,
        });
        return;
      }

      // Select Game
      console.log("[Arcade] Action button pressed in handleInput", {
        selectedIndex,
        view,
        activeGame: activeGame?.id,
      });
      const game = games[selectedIndex];
      if (game) {
        console.log("[Arcade] Calling launchGame from handleInput", {
          gameId: game.id,
          stack: new Error().stack,
        });
        launchGame(game);
      }
    }
  };

  const launchGame = async (game: {
    id: string;
    name: string;
    url: string;
  }) => {
    console.log("[Arcade] ========== launchGame CALLED ==========", {
      gameId: game.id,
      gameName: game.name,
      currentView: view,
      currentActiveGame: activeGame?.id,
      hasSocket: !!host.socket,
      socketConnected: host.socket?.connected,
      joinToken,
      callStack: new Error().stack?.split("\n").slice(0, 5).join("\n"),
    });

    if (!host.socket || !host.socket.connected) {
      console.log("[Arcade] launchGame aborted - no socket/not connected");
      return;
    }

    console.log("[Arcade] Original game URL:", game.url);
    const baseUrl = await urlBuilder.normalizeForMobile(game.url);
    console.log("[Arcade] Normalized game URL:", baseUrl);
    const controllerUrl = `${baseUrl.replace(/\/$/, "")}/joypad`;
    console.log("[Arcade] Controller URL to send:", controllerUrl);

    // Request launch from server
    host.socket.emit(
      "system:launchGame",
      {
        roomId: host.roomId,
        gameId: game.id,
        gameUrl: controllerUrl,
      },
      (ack: SystemLaunchGameAck) => {
        console.log("[Arcade] launchGame ACK received", {
          ok: ack.ok,
          joinToken: ack.joinToken,
          message: ack.message,
          currentView: view,
          currentActiveGame: activeGame?.id,
        });
        if (ack.ok && ack.joinToken) {
          console.log(
            "[Arcade] ========== Game launch successful, joinToken:",
            ack.joinToken,
            "==========",
          );
          setJoinToken(ack.joinToken);
          setActiveGame(game);
          setNormalizedGameUrl(baseUrl);
          setView("game");
        } else {
          console.error("[Arcade] Failed to launch game:", ack.message);
        }
      },
    );
  };

  // 4. The Proxy System (Removed in favor of Direct Connect)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper to exit game
  const exitGame = useCallback(() => {
    console.log("[Arcade] ========== exitGame CALLED ==========", {
      currentView: view,
      currentActiveGame: activeGame?.id,
      joinToken,
      hasSocket: !!host.socket,
      socketConnected: host.socket?.connected,
      roomId: host.roomId,
      callStack: new Error().stack?.split("\n").slice(0, 5).join("\n"),
    });

    // Set exit cooldown to prevent immediate re-launch from stale input events
    lastExitTime.current = Date.now();
    console.log("[Arcade] Exit cooldown started", {
      lastExitTime: lastExitTime.current,
    });

    // Tell server to close the game
    if (host.socket?.connected) {
      console.log("[Arcade] Emitting system:closeGame to server");
      host.socket.emit("system:closeGame", { roomId: host.roomId });
    } else {
      console.log(
        "[Arcade] Cannot emit system:closeGame - socket not connected",
      );
    }

    // Local cleanup
    console.log("[Arcade] Setting state cleanup - view=browser, clearing game");
    setView("browser");
    setActiveGame(null);
    setNormalizedGameUrl("");
    setJoinToken(null);
    console.log("[Arcade] ========== exitGame COMPLETE ==========");
  }, [host.socket, host.roomId, view, activeGame, joinToken]);

  useEffect(() => {
    exitGameRef.current = exitGame;
  }, [exitGame]);

  if (!games) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-50">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 bg-linear-to-br from-slate-900 to-black" />

      {/* --- BROWSER VIEW --- */}
      <div
        className={cn(
          "relative z-10 flex h-full flex-col p-12 transition-all duration-500",
          view === "game"
            ? "pointer-events-none scale-95 opacity-0"
            : "scale-100 opacity-100",
        )}
      >
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter text-white">
              Air Jam <span className="text-blue-500">Arcade</span>
            </h1>
            <p className="text-slate-400">Select a game using your phone</p>
          </div>
          {/* We use the Overlay Component just for the QR Code/Status */}
          <div className="origin-top-right scale-75">
            {/* Render simplified status here if needed, or rely on Overlay */}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-500">
              No games found. Create one in the dashboard!
            </div>
          ) : (
            games.map((game, idx) => (
              <Card
                key={game.id}
                className={cn(
                  "cursor-pointer border-2 bg-slate-900/50 backdrop-blur transition-all duration-200",
                  idx === selectedIndex
                    ? "scale-105 border-blue-500 bg-slate-800 shadow-[0_0_30px_rgba(59,130,246,0.5)]"
                    : "border-white/10 opacity-70",
                )}
                onClick={() => {
                  console.log("[Arcade] Card clicked", {
                    gameId: game.id,
                    idx,
                    currentView: view,
                    currentActiveGame: activeGame?.id,
                  });
                  setSelectedIndex(idx);
                  launchGame(game);
                }}
              >
                <CardContent className="flex aspect-video flex-col items-center justify-center p-8 text-center">
                  <Gamepad2
                    className={cn(
                      "mb-4 h-16 w-16",
                      idx === selectedIndex
                        ? "text-blue-400"
                        : "text-slate-600",
                    )}
                  />
                  <h3 className="text-2xl font-bold text-white">{game.name}</h3>
                  {idx === selectedIndex && (
                    <div className="mt-4 animate-pulse text-xs font-bold tracking-widest text-blue-400 uppercase">
                      Press Action to Play
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* --- GAME VIEW (IFRAME) --- */}
      <div
        className={cn(
          "absolute inset-0 z-20 bg-black transition-transform duration-500",
          view === "game" ? "translate-y-0" : "translate-y-full",
        )}
      >
        {activeGame && joinToken && (
          <>
            <iframe
              ref={iframeRef}
              src={`${normalizedGameUrl}${
                activeGame.url.includes("?") ? "&" : "?"
              }aj_room=${host.roomId}&aj_token=${joinToken}`}
              className="h-full w-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
              onLoad={() => {
                console.log(
                  "[Arcade] ========== IFRAME onLoad FIRED ==========",
                  {
                    gameId: activeGame.id,
                    joinToken,
                    src: iframeRef.current?.src,
                  },
                );
              }}
              onError={(e) => {
                console.error("[Arcade] IFRAME onError", e);
              }}
            />

            {/* Overlay Menu to Exit */}
            <div className="absolute top-4 right-4 z-50 opacity-0 transition-opacity hover:opacity-100">
              <button
                onClick={() => {
                  console.log("[Arcade] Exit Game button clicked");
                  exitGame();
                }}
                className="rounded bg-red-600/80 px-4 py-2 text-white shadow-lg backdrop-blur hover:bg-red-600"
              >
                Exit Game
              </button>
            </div>
          </>
        )}
      </div>

      {/* --- AIR JAM OVERLAY (QR Code & Players) --- */}
      {view === "browser" && <AirJamOverlay {...host} />}
    </div>
  );
}
