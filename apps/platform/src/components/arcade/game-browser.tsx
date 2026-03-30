"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SoundManifest } from "@air-jam/sdk";
import { useAudio } from "@air-jam/sdk";
import { Gamepad2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GamePlayerGame } from "./game-player";

const ARCADE_SOUND_MANIFEST: SoundManifest = {
  select: {
    src: ["/audio/select.wav"],
    volume: 0.6,
    category: "sfx",
  },
};

const SCROLL_TOP_THRESHOLD_PX = 12;

interface GameBrowserProps {
  games: GamePlayerGame[];
  selectedIndex: number;
  isVisible: boolean;
  onSelectGame: (game: GamePlayerGame, index: number) => void;
  header?: React.ReactNode;
  /** Fires when the browser list is scrolled to / away from the top (for chrome styling). */
  onScrollTopChange?: (atTop: boolean) => void;
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
  onScrollTopChange,
}: GameBrowserProps) => {
  const scrollRootRef = useRef<HTMLDivElement>(null);
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

  const emitScrollTop = useCallback(() => {
    if (!onScrollTopChange) return;
    const el = scrollRootRef.current;
    if (!el) return;
    onScrollTopChange(el.scrollTop <= SCROLL_TOP_THRESHOLD_PX);
  }, [onScrollTopChange]);

  useEffect(() => {
    if (!isVisible) return;
    emitScrollTop();
    queueMicrotask(emitScrollTop);
  }, [isVisible, games.length, emitScrollTop]);

  return (
    <div
      ref={scrollRootRef}
      onScroll={emitScrollTop}
      className={cn(
        "relative z-10 flex h-full flex-col overflow-y-auto px-12 pt-2 pb-12 transition-all duration-500",
        isVisible
          ? "scale-100 opacity-100"
          : "pointer-events-none scale-95 opacity-0",
      )}
    >
      {/* Custom header positioned at top */}
      {header && (
        <div className="absolute top-0 right-0 left-0 z-50 p-4">{header}</div>
      )}

      {/* Title: in flow, directly under arcade chrome gutter */}
      <header className="z-40 flex shrink-0 flex-col items-center pb-5 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
          Air Jam{" "}
          <span className="font-bold text-airjam-cyan">Arcade</span>
        </h1>
        <p className="mt-1.5 max-w-md text-sm tracking-wide text-slate-500">
          Select a game using your phone
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {games.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-500">
            No live Arcade releases are listed yet. Upload a release, make it
            live, then list the game in Arcade from the dashboard.
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
                  "cursor-pointer overflow-hidden border bg-slate-950/60 py-0 shadow-lg backdrop-blur-md transition-all duration-200",
                  isSelected
                    ? "border-airjam-cyan/90 scale-[1.02] gap-0 bg-slate-900/80"
                    : "gap-0 border-white/8 opacity-90 hover:border-white/15 hover:opacity-100",
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
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <Gamepad2
                          aria-hidden
                          className={cn(
                            "absolute right-[-22%] bottom-[-34%] h-[min(125%,26rem)] w-[min(125%,26rem)] max-h-[420px] max-w-[420px] min-h-56 min-w-56 sm:min-h-72 sm:min-w-72 md:min-h-80 md:min-w-80",
                            "-rotate-26",
                            "text-slate-500 opacity-[0.09]",
                            isSelected && "text-airjam-cyan opacity-[0.14]",
                          )}
                          strokeWidth={2}
                        />
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/5" />

                  <div className="absolute right-0 bottom-0 left-0 p-4">
                    {game.catalogBadgeLabel ? (
                      <div className="mb-3">
                        <span className="inline-flex rounded-full border border-airjam-cyan/40 bg-airjam-cyan/12 px-2.5 py-1 text-[11px] font-semibold tracking-[0.18em] text-airjam-cyan uppercase">
                          {game.catalogBadgeLabel}
                        </span>
                      </div>
                    ) : null}
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
