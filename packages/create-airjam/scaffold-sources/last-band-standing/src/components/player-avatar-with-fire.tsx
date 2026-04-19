import { type PlayerProfile } from "@air-jam/sdk";
import { PlayerAvatar } from "@air-jam/sdk/ui";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface PlayerAvatarWithFireProps {
  player: PlayerProfile;
  size?: "sm" | "md" | "lg";
  className?: string;
  avatarClassName?: string;
  showFire?: boolean;
}

const fireSizeClassByAvatarSize = {
  sm: "h-10 w-10 -bottom-1",
  md: "h-16 w-16 -bottom-1",
  lg: "h-20 w-20 -bottom-1",
} as const;

const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  return prefersReducedMotion;
};

export const PlayerAvatarWithFire = ({
  player,
  size = "md",
  className,
  avatarClassName,
  showFire = false,
}: PlayerAvatarWithFireProps) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn("relative isolate inline-flex", className)}>
      {showFire && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2",
            fireSizeClassByAvatarSize[size],
          )}
          aria-hidden
        >
          <div
            className="absolute inset-0 rounded-full opacity-65 blur-lg"
            style={{
              background:
                "radial-gradient(circle, rgba(255, 120, 0, 0.8) 0%, rgba(255, 70, 0, 0.35) 45%, transparent 70%)",
              transform: "scale(1.8)",
            }}
          />
          {prefersReducedMotion ? (
            <img
              src="/lottie/Fire.png"
              alt=""
              className="relative z-0 h-full w-full scale-[1.7] object-contain"
              loading="lazy"
            />
          ) : (
            <DotLottieReact
              src="/lottie/Fire.json"
              loop
              autoplay
              className="relative z-0 h-full w-full origin-bottom scale-[1.7]"
            />
          )}
        </div>
      )}
      <PlayerAvatar
        player={player}
        size={size}
        className={cn("relative z-10", avatarClassName)}
      />
    </div>
  );
};
