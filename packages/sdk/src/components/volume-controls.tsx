import { Headphones, Music, Volume2 } from "lucide-react";
import {
  usePlatformAudioSettings,
  type PlatformAudioSettingsApi,
} from "../settings/platform-settings-runtime";
import { cn } from "../utils/cn";
import { Slider } from "./ui/slider";

interface VolumeControlsProps {
  className?: string;
  compact?: boolean;
  values?: Pick<
    PlatformAudioSettingsApi,
    "masterVolume" | "musicVolume" | "sfxVolume"
  >;
  readOnly?: boolean;
  onMasterVolumeChange?: (volume: number) => void;
  onMusicVolumeChange?: (volume: number) => void;
  onSfxVolumeChange?: (volume: number) => void;
}

export function VolumeControls(props: VolumeControlsProps) {
  if (props.values) {
    return <ControlledVolumeControls {...props} />;
  }

  return <OwnedVolumeControls {...props} />;
}

function OwnedVolumeControls({
  className,
  compact,
}: VolumeControlsProps) {
  const {
    masterVolume,
    musicVolume,
    sfxVolume,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
  } = usePlatformAudioSettings();

  return (
    <ControlledVolumeControls
      className={className}
      compact={compact}
      values={{ masterVolume, musicVolume, sfxVolume }}
      onMasterVolumeChange={setMasterVolume}
      onMusicVolumeChange={setMusicVolume}
      onSfxVolumeChange={setSfxVolume}
      readOnly={false}
    />
  );
}

function ControlledVolumeControls({
  className,
  compact,
  values,
  readOnly = false,
  onMasterVolumeChange,
  onMusicVolumeChange,
  onSfxVolumeChange,
}: VolumeControlsProps) {
  if (!values) {
    throw new Error("ControlledVolumeControls requires values");
  }

  const { masterVolume, musicVolume, sfxVolume } = values;

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
          onValueChange={(sliderValues) =>
            onMasterVolumeChange?.(sliderValues[0] / 100)
          }
          min={0}
          max={100}
          step={1}
          className="w-full"
          aria-label="Master volume"
          disabled={readOnly}
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
          onValueChange={(sliderValues) =>
            onMusicVolumeChange?.(sliderValues[0] / 100)
          }
          min={0}
          max={100}
          step={1}
          className="w-full"
          aria-label="Music volume"
          disabled={readOnly}
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
          onValueChange={(sliderValues) =>
            onSfxVolumeChange?.(sliderValues[0] / 100)
          }
          min={0}
          max={100}
          step={1}
          className="w-full"
          aria-label="SFX volume"
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
