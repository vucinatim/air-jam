"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Gamepad2 } from "lucide-react";
import type { GamePlayerGame } from "./game-player";

interface GameBrowserProps {
  games: GamePlayerGame[];
  selectedIndex: number;
  isVisible: boolean;
  onSelectGame: (game: GamePlayerGame, index: number) => void;
  header?: React.ReactNode;
}

/**
 * Renders a grid of game cards for the arcade browser.
 * Users can click on cards to select and launch games.
 */
export const GameBrowser = ({
  games,
  selectedIndex,
  isVisible,
  onSelectGame,
  header,
}: GameBrowserProps) => {
  return (
    <div
      className={cn(
        "relative z-10 flex h-full flex-col p-12 transition-all duration-500",
        isVisible
          ? "scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0",
      )}
    >
      <header className="mb-12 flex items-center justify-between">
        <div className={cn(header ? "mt-12" : "")}>
          <h1 className="text-4xl font-bold tracking-tighter text-white">
            Air Jam <span className="text-blue-500">Arcade</span>
          </h1>
          <p className="text-slate-400">Select a game using your phone</p>
        </div>
      </header>

      {/* Custom header positioned at top */}
      {header && (
        <div className="absolute top-0 right-0 left-0 z-50 p-4">{header}</div>
      )}

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
              onClick={() => onSelectGame(game, idx)}
            >
              <CardContent className="flex aspect-video flex-col items-center justify-center p-8 text-center">
                <Gamepad2
                  className={cn(
                    "mb-4 h-16 w-16",
                    idx === selectedIndex ? "text-blue-400" : "text-slate-600",
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
  );
};
