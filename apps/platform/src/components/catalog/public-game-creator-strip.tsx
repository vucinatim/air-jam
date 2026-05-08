"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPublicGameCreators } from "@/lib/public-game-presentation";
import { cn } from "@/lib/utils";

type PublicGameShape = {
  name: string;
  slug?: string | null;
  ownerName?: string | null;
};

type PublicGameCreatorStripProps = {
  game: PublicGameShape;
  className?: string;
  avatarClassName?: string;
  maxVisible?: number;
  onClick?: React.MouseEventHandler<HTMLElement>;
};

const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AJ";

export const PublicGameCreatorStrip = ({
  game,
  className,
  avatarClassName,
  maxVisible = 3,
  onClick,
}: PublicGameCreatorStripProps) => {
  const creators = getPublicGameCreators(game);
  if (creators.length === 0) {
    return null;
  }

  const visibleCreators = creators.slice(0, maxVisible);
  const overflow = creators.length - visibleCreators.length;
  const isSingleCreator = creators.length === 1 && overflow === 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            isSingleCreator
              ? "inline-flex rounded-full border border-white/12 bg-black/50 p-1 shadow-lg backdrop-blur-md"
              : "inline-flex rounded-full border border-white/12 bg-black/50 px-1.5 py-1 shadow-lg backdrop-blur-md",
            className,
          )}
          onClick={onClick}
        >
          <AvatarGroup>
            {visibleCreators.map((creator) => {
              const avatar = (
                <Avatar
                  key={creator.githubUrl ?? creator.githubHandle ?? creator.name}
                  className={cn("ring-black/80 size-7 ring-2", avatarClassName)}
                >
                  {creator.avatarUrl ? (
                    <AvatarImage src={creator.avatarUrl} alt={creator.name} />
                  ) : null}
                  <AvatarFallback className="bg-zinc-800 text-[10px] font-semibold text-white">
                    {creator.initials ?? getInitials(creator.name)}
                  </AvatarFallback>
                </Avatar>
              );

              if (creator.githubUrl) {
                return (
                  <a
                    key={creator.githubUrl}
                    href={creator.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${creator.name} on GitHub`}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
                  >
                    {avatar}
                  </a>
                );
              }

              return avatar;
            })}
            {overflow > 0 ? (
              <AvatarGroupCount className="ring-black/80 size-7 bg-zinc-900/90 text-[10px] text-white ring-2">
                +{overflow}
              </AvatarGroupCount>
            ) : null}
          </AvatarGroup>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {creators.map((creator) => creator.name).join(", ")}
      </TooltipContent>
    </Tooltip>
  );
};
