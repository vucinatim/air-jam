import type { JSX } from "react";
import type { PlayerProfile } from "../protocol";
import { cn } from "../utils/cn";
import { PlayerAvatar } from "./player-avatar";

interface PlayerAvatarStripProps {
  players: PlayerProfile[];
  /** Avatars shown before a +N badge (default 4). */
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Extra classes on each `PlayerAvatar` (e.g. `ring-2 ring-black/90` on dark headers). */
  avatarClassName?: string;
  /** Extra classes on the +N overflow badge when present. */
  overflowBadgeClassName?: string;
}

const overflowSizeClasses: Record<
  NonNullable<PlayerAvatarStripProps["size"]>,
  string
> = {
  sm: "h-9 w-9 min-h-9 min-w-9 text-[0.625rem]",
  md: "h-12 w-12 min-h-12 min-w-12 text-[11px]",
  lg: "h-16 w-16 min-h-16 min-w-16 text-xs",
};

/**
 * Overlapping row of {@link PlayerAvatar} images, with an optional +N overflow badge.
 */
export const PlayerAvatarStrip = ({
  players,
  maxVisible = 4,
  size = "sm",
  className,
  avatarClassName = "",
  overflowBadgeClassName = "",
}: PlayerAvatarStripProps): JSX.Element => {
  const visible = players.slice(0, maxVisible);
  const overflow = Math.max(0, players.length - maxVisible);

  return (
    <div className={cn("flex items-center -space-x-2", className)}>
      {visible.map((player) => (
        <PlayerAvatar
          key={player.id}
          player={player}
          size={size}
          className={avatarClassName}
        />
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 border-[hsl(var(--border))] bg-secondary/50 font-semibold tabular-nums text-foreground shadow-sm",
            overflowSizeClasses[size],
            overflowBadgeClassName,
          )}
          aria-label={`${overflow} more players`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};
