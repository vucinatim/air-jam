"use client";

import { useRef, useState, useEffect } from "react";
import { api } from "@/trpc/react";
import {
  useAirJamHost,
  AirJamOverlay,
  type ControllerInputEvent,
  urlBuilder,
} from "@air-jam/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, Gamepad2 } from "lucide-react";

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
        console.log("[Arcade] Received close_child request");
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
    broadcastCurrentState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedIndex, games, host.connectionStatus]);

  // 3. Navigation Logic
  const lastInputTime = useRef<number>(0);
  const INPUT_DEBOUNCE = 200; // ms

  const handleInput = (event: ControllerInputEvent) => {
    // Only handle navigation if we are in the browser view
    if (view !== "browser" || !games || games.length === 0) {
      return;
    }

    const { input } = event;
    const now = Date.now();

    if (now - lastInputTime.current > INPUT_DEBOUNCE) {
      if (input.vector.y < -0.5) {
        // Up (Previous)
        setSelectedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? games.length - 1 : next;
        });
        lastInputTime.current = now;
      } else if (input.vector.y > 0.5) {
        // Down (Next)
        setSelectedIndex((prev) => {
          const next = prev + 1;
          return next >= games.length ? 0 : next;
        });
        lastInputTime.current = now;
      } else if (input.vector.x < -0.5) {
        // Left (Previous)
        setSelectedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? games.length - 1 : next;
        });
        lastInputTime.current = now;
      } else if (input.vector.x > 0.5) {
        // Right (Next)
        setSelectedIndex((prev) => {
          const next = prev + 1;
          return next >= games.length ? 0 : next;
        });
        lastInputTime.current = now;
      }
    }

    if (input.action) {
      // Select Game
      const game = games[selectedIndex];
      if (game) {
        launchGame(game);
      }
    }
  };

  const launchGame = async (game: { id: string; name: string; url: string }) => {
      if (!host.socket.connected) return;

      console.log("[Arcade] Original game URL:", game.url);
      const baseUrl = await urlBuilder.normalizeForMobile(game.url);
      console.log("[Arcade] Normalized game URL:", baseUrl);
      const controllerUrl = `${baseUrl.replace(/\/$/, "")}/joypad`;
      console.log("[Arcade] Controller URL to send:", controllerUrl);
      
      // Request launch from server
      host.socket.emit("system:launchGame", {
          roomId: host.roomId,
          gameId: game.id,
          gameUrl: controllerUrl
      }, (ack: any) => {
          if (ack.ok && ack.joinToken) {
              console.log("[Arcade] Game launch successful, joinToken:", ack.joinToken);
              setJoinToken(ack.joinToken);
              setActiveGame(game);
              setNormalizedGameUrl(baseUrl);
              setView("game");
          } else {
              console.error("Failed to launch game:", ack.message);
          }
      });
  };

  // 4. The Proxy System (Removed in favor of Direct Connect)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Helper to exit game
  const exitGame = () => {
    // Tell server to close the game
    if (host.socket.connected) {
        host.socket.emit("system:closeGame", { roomId: host.roomId });
    }
    
    // Local cleanup
    setView("browser");
    setActiveGame(null);
    setNormalizedGameUrl("");
    setJoinToken(null);
  };

  useEffect(() => {
    exitGameRef.current = exitGame;
  }, [exitGame]);

  if (!games) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-slate-950 overflow-hidden font-sans text-slate-50">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-900 to-black z-0" />

      {/* --- BROWSER VIEW --- */}
      <div
        className={cn(
          "relative z-10 flex h-full flex-col p-12 transition-all duration-500",
          view === "game"
            ? "opacity-0 scale-95 pointer-events-none"
            : "opacity-100 scale-100"
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
          <div className="scale-75 origin-top-right">
            {/* Render simplified status here if needed, or rely on Overlay */}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 py-20">
              No games found. Create one in the dashboard!
            </div>
          ) : (
            games.map((game, idx) => (
              <Card
                key={game.id}
                className={cn(
                  "border-2 bg-slate-900/50 backdrop-blur transition-all duration-200 cursor-pointer",
                  idx === selectedIndex
                    ? "border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)] scale-105 bg-slate-800"
                    : "border-white/10 opacity-70"
                )}
                onClick={() => {
                  setSelectedIndex(idx);
                  launchGame(game);
                }}
              >
                <CardContent className="flex flex-col items-center justify-center p-8 text-center aspect-video">
                  <Gamepad2
                    className={cn(
                      "w-16 h-16 mb-4",
                      idx === selectedIndex ? "text-blue-400" : "text-slate-600"
                    )}
                  />
                  <h3 className="text-2xl font-bold text-white">{game.name}</h3>
                  {idx === selectedIndex && (
                    <div className="mt-4 animate-pulse text-blue-400 font-bold uppercase tracking-widest text-xs">
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
          view === "game" ? "translate-y-0" : "translate-y-full"
        )}
      >
        {activeGame && joinToken && (
          <>
            <iframe
              ref={iframeRef}
              src={`${normalizedGameUrl}${
                activeGame.url.includes("?") ? "&" : "?"
              }aj_room=${host.roomId}&aj_token=${joinToken}`}
              className="w-full h-full border-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; gamepad"
            />

            {/* Overlay Menu to Exit */}
            <div className="absolute top-4 right-4 opacity-0 hover:opacity-100 transition-opacity z-50">
              <button
                onClick={exitGame}
                className="bg-red-600/80 hover:bg-red-600 text-white px-4 py-2 rounded shadow-lg backdrop-blur"
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
