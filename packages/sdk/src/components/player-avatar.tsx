import type { JSX } from "react";
import { Bot } from "lucide-react";
import type { PlayerProfile } from "../protocol";
import { cn } from "../utils/cn";
import { getPlayerAvatarImageUrl } from "../utils/player-avatar-url";

// Convert hex color to rgba with opacity
const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${opacity})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

interface PlayerAvatarProps {
  player: PlayerProfile;
  isBot?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PlayerAvatar = ({
  player,
  isBot = false,
  size = "md",
  className = "",
}: PlayerAvatarProps): JSX.Element => {
  const accentColor = player.color || "hsl(var(--border))";
  const sizeClasses = {
    sm: "h-9 w-9 border-2",
    md: "h-12 w-12 border-4",
    lg: "h-16 w-16 border-4",
  };

  const shadowStyles = {
    sm: player.color
      ? `inset 0 0 4px rgba(0, 0, 0, 0.2), 0 0 8px ${hexToRgba(player.color, 0.4)}`
      : "inset 0 0 4px rgba(0, 0, 0, 0.2)",
    md: player.color
      ? `inset 0 0 10px rgba(0, 0, 0, 0.4), 0 0 20px ${hexToRgba(player.color, 0.6)}, 0 0 10px ${hexToRgba(player.color, 0.8)}`
      : "inset 0 0 10px rgba(0, 0, 0, 0.4), 0 0 20px hsl(var(--border) / 0.5)",
    lg: player.color
      ? `inset 0 0 12px rgba(0, 0, 0, 0.4), 0 0 24px ${hexToRgba(player.color, 0.6)}, 0 0 12px ${hexToRgba(player.color, 0.8)}`
      : "inset 0 0 12px rgba(0, 0, 0, 0.4), 0 0 24px hsl(var(--border) / 0.5)",
  };

  const iconSizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const shellClassName = cn(
    "shrink-0 rounded-full shadow-lg",
    sizeClasses[size],
    className,
  );

  if (isBot) {
    return (
      <div
        role="img"
        aria-label={player.label}
        className={cn(
          "bg-secondary/40 flex items-center justify-center",
          shellClassName,
        )}
        style={{
          borderColor: accentColor,
          color: accentColor,
          boxShadow: shadowStyles[size],
        }}
      >
        <Bot aria-hidden="true" className={iconSizeClasses[size]} />
      </div>
    );
  }

  return (
    <img
      src={getPlayerAvatarImageUrl(player)}
      alt={player.label}
      className={cn("bg-secondary/30", shellClassName)}
      style={{
        borderColor: accentColor,
        boxShadow: shadowStyles[size],
      }}
    />
  );
};
