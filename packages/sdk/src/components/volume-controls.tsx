import { Volume2, Music, Headphones } from "lucide-react";
import { useVolumeStore } from "../audio/volume-store";
import { Slider } from "./ui/slider";
import { cn } from "../utils/cn";

interface VolumeControlsProps {
  className?: string;
}

export function VolumeControls({ className }: VolumeControlsProps) {
  const {
    masterVolume,
    musicVolume,
    sfxVolume,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
  } = useVolumeStore();

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Volume</span>
      </div>

      {/* Master Volume */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Master</label>
          <span className="text-xs font-mono text-muted-foreground">
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
            <Music className="h-3 w-3 text-muted-foreground" />
            <label className="text-xs text-muted-foreground">Music</label>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
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
            <Headphones className="h-3 w-3 text-muted-foreground" />
            <label className="text-xs text-muted-foreground">SFX</label>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
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
