"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SoundManifest } from "@air-jam/sdk";
import { useAudio } from "@air-jam/sdk";
import { Gamepad2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audio = useAudio(ARCADE_SOUND_MANIFEST);
  const prevSelectedIndexRef = useRef<number | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<
    Record<string, boolean>
  >({});
  const [videoReady, setVideoReady] = useState<Record<string, boolean>>({});
  const [videoLoadErrors, setVideoLoadErrors] = useState<
    Record<string, boolean>
  >({});

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

  // Keep only the selected card's video playing.
  useEffect(() => {
    games.forEach((game, idx) => {
      const video = videoRefs.current[game.id];
      if (!video) return;

      if (idx === selectedIndex) {
        void video.play().catch(() => {
          // Ignore autoplay race errors; browser policies are satisfied by muted+inline.
        });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [games, selectedIndex]);

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
          games.map((game, idx) => {
            const isSelected = idx === selectedIndex;
            const hasThumbnail =
              !!game.thumbnailUrl && !imageLoadErrors[game.id];
            const hasVideo = !!game.videoUrl && !videoLoadErrors[game.id];
            const shouldRevealVideo =
              isSelected && hasVideo && !!videoReady[game.id];
            const shouldShowFallbackIcon =
              !hasThumbnail && !(isSelected && hasVideo);

            return (
              <Card
                key={game.id}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                className={cn(
                  "cursor-pointer overflow-hidden border-2 bg-slate-900/50 py-0 backdrop-blur transition-all duration-200",
                  isSelected
                    ? "border-airjam-cyan scale-105 gap-0 bg-slate-800"
                    : "gap-0 border-white/10 opacity-80",
                )}
                style={
                  isSelected
                    ? {
                        boxShadow: `0 0 30px color-mix(in srgb, var(--color-airjam-cyan) 50%, transparent)`,
                      }
                    : undefined
                }
                onClick={() => onSelectGame(game, idx)}
              >
                <CardContent className="relative aspect-video p-0">
                  <div className="absolute inset-0 bg-slate-900">
                    {hasVideo && (
                      <video
                        ref={(el) => {
                          videoRefs.current[game.id] = el;
                        }}
                        src={game.videoUrl!}
                        className={cn(
                          "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300",
                          shouldRevealVideo ? "opacity-100" : "opacity-0",
                        )}
                        muted
                        loop
                        playsInline
                        preload="auto"
                        onLoadedData={() =>
                          setVideoReady((current) => ({
                            ...current,
                            [game.id]: true,
                          }))
                        }
                        onError={() =>
                          setVideoLoadErrors((current) => ({
                            ...current,
                            [game.id]: true,
                          }))
                        }
                      />
                    )}
                    {hasThumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element -- user-provided remote URLs are not known at build time
                      <img
                        src={game.thumbnailUrl!}
                        alt={`${game.name} thumbnail`}
                        className={cn(
                          "absolute inset-0 block h-full w-full object-cover object-center transition-opacity duration-300",
                          shouldRevealVideo ? "opacity-0" : "opacity-100",
                        )}
                        loading="lazy"
                        onError={() =>
                          setImageLoadErrors((current) => ({
                            ...current,
                            [game.id]: true,
                          }))
                        }
                      />
                    )}
                    {shouldShowFallbackIcon && (
                      <div className="flex h-full w-full items-center justify-center">
                        <Gamepad2
                          className={cn(
                            "h-16 w-16",
                            isSelected ? "text-airjam-cyan" : "text-slate-600",
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/5" />

                  <div className="absolute right-0 bottom-0 left-0 p-4">
                    <h3 className="line-clamp-2 text-left text-2xl font-bold text-white md:text-3xl">
                      {game.name}
                    </h3>
                    <p className="text-left text-base font-medium text-slate-200 md:text-lg">
                      by {game.ownerName || "Unknown Creator"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
