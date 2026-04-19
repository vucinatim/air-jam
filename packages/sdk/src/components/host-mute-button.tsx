import { Volume2, VolumeX } from "lucide-react";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";

export interface HostMuteButtonProps {
  muted: boolean;
  onToggle: () => void;
  className?: string;
  labelClassName?: string;
  mutedLabel?: string;
  unmutedLabel?: string;
}

export function HostMuteButton({
  muted,
  onToggle,
  className,
  labelClassName,
  mutedLabel = "Unmute",
  unmutedLabel = "Mute",
}: HostMuteButtonProps) {
  const label = muted ? mutedLabel : unmutedLabel;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onToggle}
      aria-pressed={muted}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-full border border-white/25 bg-black/35 px-3 text-white backdrop-blur-sm hover:bg-black/55",
        className,
      )}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      <span
        className={cn(
          "text-[11px] font-semibold tracking-[0.16em] uppercase",
          labelClassName,
        )}
      >
        {label}
      </span>
    </Button>
  );
}
