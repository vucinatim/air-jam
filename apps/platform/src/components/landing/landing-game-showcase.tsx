"use client";

import { landingCopy } from "@/components/landing/landing-content";
import { Reveal } from "@/components/landing/landing-motion";
import { SectionHeader } from "@/components/landing/landing-section-header";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { Gamepad2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

type Game = {
  id: string;
  name: string;
  slug: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  coverUrl: string | null;
  ownerName: string | null;
};

type HoveredMedia = {
  videoUrl?: string | null;
  imageUrl?: string | null;
};

type GameCardProps = {
  game: Game;
  index: number;
  onHover: (media: HoveredMedia | null) => void;
};

const GameCard = ({ game, index, onHover }: GameCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const href = game.slug ? `/arcade/${game.slug}` : "/arcade";

  const handleMouseEnter = () => {
    onHover({
      videoUrl: game.videoUrl,
      imageUrl: game.coverUrl ?? game.thumbnailUrl,
    });
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    onHover(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Reveal
      delay={index * 0.06}
      margin="-40px"
      className="border-border/40 bg-card/15 group hover:border-airjam-cyan/30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.28)] flex flex-col overflow-hidden rounded-2xl border transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1"
    >
      <Link
        href={href}
        className="block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="bg-muted/30 relative aspect-video w-full overflow-hidden">
          <div className="absolute inset-0 z-10 bg-linear-to-t from-black/40 via-transparent to-transparent" />
          {game.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote arcade thumbnails from user-provided URLs
            <img
              src={game.thumbnailUrl}
              alt=""
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                game.videoUrl ? "group-hover:opacity-0" : ""
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Gamepad2 className="text-muted-foreground/40 h-14 w-14" />
            </div>
          )}
          {game.videoUrl ? (
            <video
              ref={videoRef}
              src={game.videoUrl}
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          ) : null}
        </div>
        <div className="p-5">
          <h3 className="text-lg font-semibold tracking-tight">{game.name}</h3>
          {game.ownerName ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {game.ownerName}
            </p>
          ) : null}
        </div>
      </Link>
    </Reveal>
  );
};

export const LandingGameShowcase = () => {
  const { gameShowcase } = landingCopy;
  const { data: games, isLoading } = api.game.getAllPublic.useQuery();
  const featured = games?.slice(0, 3) ?? [];
  const [hoveredMedia, setHoveredMedia] = useState<HoveredMedia | null>(null);

  const hasBg = hoveredMedia?.videoUrl || hoveredMedia?.imageUrl;

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      {/* Blurred background that crossfades to hovered game's video or cover */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: hasBg ? 1 : 0 }}
      >
        {hoveredMedia?.videoUrl ? (
          <video
            key={hoveredMedia.videoUrl}
            src={hoveredMedia.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full scale-110 object-cover blur-3xl"
          />
        ) : hoveredMedia?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- decorative blurred background
          <img
            src={hoveredMedia.imageUrl}
            alt=""
            className="h-full w-full scale-110 object-cover blur-3xl"
          />
        ) : null}
        <div className="absolute inset-0 bg-black/76" />
      </div>

      <div className="relative container mx-auto max-w-6xl px-4">
        <SectionHeader
          title={gameShowcase.title}
          subtitle={gameShowcase.subtitle}
        />

        <div className="mt-14">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="text-airjam-cyan h-10 w-10 animate-spin" />
            </div>
          ) : featured.length === 0 ? (
            <div className="border-border/40 bg-muted/10 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed py-20 text-center">
              <Gamepad2 className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                Listed Arcade games will show up here. Jump into the arcade to
                play what&apos;s live now.
              </p>
              <Button asChild variant="secondary">
                <Link href={gameShowcase.footerCta.href}>
                  {gameShowcase.footerCta.label}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((game, i) => (
                <GameCard
                  key={game.id}
                  game={game}
                  index={i}
                  onHover={setHoveredMedia}
                />
              ))}
            </div>
          )}
        </div>

        {!isLoading && featured.length > 0 ? (
          <div className="mt-10 flex justify-center">
            <Button
              asChild
              variant="outline"
              className="border-airjam-cyan/35 bg-background/35 px-5 shadow-[0_10px_24px_rgba(0,0,0,0.2)] backdrop-blur-sm"
            >
              <Link href={gameShowcase.footerCta.href}>
                {gameShowcase.footerCta.label}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
};
