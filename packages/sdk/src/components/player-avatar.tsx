import type { JSX } from "react";
import type { PlayerProfile } from "../protocol";

// Generate a consistent avatar URL for a player based on their ID
const getPlayerAvatarUrl = (playerId: string): string => {
  // Use DiceBear API with identicon style for GitHub-like avatars
  // The seed ensures the same player ID always gets the same avatar
  return `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${encodeURIComponent(
    playerId,
  )}`;
};

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
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PlayerAvatar = ({
  player,
  size = "md",
  className = "",
}: PlayerAvatarProps): JSX.Element => {
  const sizeClasses = {
    sm: "h-8 w-8 border-2",
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

  return (
    <img
      src={getPlayerAvatarUrl(player.id)}
      alt={player.label}
      className={`bg-secondary/30 shrink-0 rounded-full shadow-lg ${sizeClasses[size]} ${className}`}
      style={{
        borderColor: player.color || "hsl(var(--border))",
        boxShadow: shadowStyles[size],
      }}
    />
  );
};

