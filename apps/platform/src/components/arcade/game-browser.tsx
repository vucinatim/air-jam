"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SoundManifest } from "@air-jam/sdk";
import { useAudio } from "@air-jam/sdk";
import { Gamepad2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { GamePlayerGame } from "./game-player";

const ARCADE_SOUND_MANIFEST: SoundManifest = {
  select: {
    src: ["/audio/select.wav"],
    volume: 0.6,
    category: "sfx",
  },
};

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
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const audio = useAudio(ARCADE_SOUND_MANIFEST);
  const prevSelectedIndexRef = useRef<number | null>(null);

  // Auto-scroll to keep selected game visible
  useEffect(() => {
    const selectedCard = cardRefs.current[selectedIndex];
    if (selectedCard) {
      selectedCard.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }
  }, [selectedIndex]);

  // Play sound when selection changes
  useEffect(() => {
    // Skip on initial mount or if selection hasn't actually changed
    if (prevSelectedIndexRef.current === null) {
      prevSelectedIndexRef.current = selectedIndex;
      return;
    }

    if (prevSelectedIndexRef.current !== selectedIndex && isVisible) {
      audio.play("select");
      prevSelectedIndexRef.current = selectedIndex;
    }
  }, [selectedIndex, isVisible, audio]);

  return (
    <div
      className={cn(
        "relative z-10 flex h-full flex-col overflow-y-auto p-12 transition-all duration-500",
        isVisible
          ? "scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0",
      )}
    >
      {/* Title centered at top */}
      <header className="absolute top-0 right-0 left-0 z-40 flex flex-col items-center justify-center pt-16">
        <h1 className="text-4xl font-bold tracking-tighter text-white">
          Air Jam <span className="text-airjam-cyan">Arcade</span>
        </h1>
        <p className="mt-2 text-slate-400">Select a game using your phone</p>
      </header>

      {/* Custom header positioned at top */}
      {header && (
        <div className="absolute top-0 right-0 left-0 z-50 p-4">{header}</div>
      )}

      <div className="grid grid-cols-1 gap-6 pt-32 md:grid-cols-2 lg:grid-cols-3">
        {games.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500">
            No games found. Create one in the dashboard!
          </div>
        ) : (
          games.map((game, idx) => (
            <Card
              key={game.id}
              ref={(el) => {
                cardRefs.current[idx] = el;
              }}
              className={cn(
                "cursor-pointer border-2 bg-slate-900/50 backdrop-blur transition-all duration-200",
                idx === selectedIndex
                  ? "border-airjam-cyan scale-105 bg-slate-800"
                  : "border-white/10 opacity-70",
              )}
              style={
                idx === selectedIndex
                  ? {
                      boxShadow: `0 0 30px color-mix(in srgb, var(--color-airjam-cyan) 50%, transparent)`,
                    }
                  : undefined
              }
              onClick={() => onSelectGame(game, idx)}
            >
              <CardContent className="flex aspect-video flex-col items-center justify-center p-8 text-center">
                <Gamepad2
                  className={cn(
                    "mb-4 h-16 w-16",
                    idx === selectedIndex
                      ? "text-airjam-cyan"
                      : "text-slate-600",
                  )}
                />
                <h3 className="text-2xl font-bold text-white">{game.name}</h3>
                {idx === selectedIndex && (
                  <div className="text-airjam-cyan mt-4 animate-pulse text-xs font-bold tracking-widest uppercase">
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
