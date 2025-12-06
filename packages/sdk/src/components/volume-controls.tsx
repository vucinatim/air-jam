import { Headphones, Music, Volume2 } from "lucide-react";
import { useVolumeStore } from "../audio/volume-store";
import { cn } from "../utils/cn";
import { Slider } from "./ui/slider";

interface VolumeControlsProps {
  className?: string;
  compact?: boolean;
}

export function VolumeControls({ className, compact }: VolumeControlsProps) {
  const {
    masterVolume,
    musicVolume,
    sfxVolume,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
  } = useVolumeStore();

  return (
    <div className={cn("flex flex-col gap-3", compact && "gap-1", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 className="text-muted-foreground h-4 w-4" />
        <span className="text-sm font-medium">Volume</span>
      </div>

      {/* Master Volume */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-muted-foreground text-xs">Master</label>
          <span className="text-muted-foreground font-mono text-xs">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        <Slider
          value={[masterVolume * 100]}
          onValueChange={(values) => setMasterVolume(values[0] / 100)}
          min={0}
          max={100}
          step={1}
          className="w-full"
          aria-label="Master volume"
        />
      </div>

      {/* Music Volume */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Music className="text-muted-foreground h-3 w-3" />
            <label className="text-muted-foreground text-xs">Music</label>
          </div>
          <span className="text-muted-foreground font-mono text-xs">
            {Math.round(musicVolume * 100)}%
          </span>
        </div>
        <Slider
          value={[musicVolume * 100]}
          onValueChange={(values) => setMusicVolume(values[0] / 100)}
          min={0}
          max={100}
          step={1}
          className="w-full"
          aria-label="Music volume"
        />
      </div>

      {/* SFX Volume */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Headphones className="text-muted-foreground h-3 w-3" />
            <label className="text-muted-foreground text-xs">SFX</label>
          </div>
          <span className="text-muted-foreground font-mono text-xs">
            {Math.round(sfxVolume * 100)}%
          </span>
        </div>
        <Slider
          value={[sfxVolume * 100]}
          onValueChange={(values) => setSfxVolume(values[0] / 100)}
          min={0}
          max={100}
          step={1}
          className="w-full"
          aria-label="SFX volume"
        />
      </div>
    </div>
  );
}
