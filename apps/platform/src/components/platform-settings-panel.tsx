"use client";

import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { PlatformSettingsSnapshot } from "@air-jam/sdk";
import { usePlatformSettings } from "@air-jam/sdk";
import { VolumeControls } from "@air-jam/sdk/ui";

interface PlatformSettingsPanelProps {
  className?: string;
  compact?: boolean;
  settings?: PlatformSettingsSnapshot;
  readOnly?: boolean;
  onUpdateAudio?: (
    patch: Partial<PlatformSettingsSnapshot["audio"]>,
  ) => void;
  onUpdateAccessibility?: (
    patch: Partial<PlatformSettingsSnapshot["accessibility"]>,
  ) => void;
  onUpdateFeedback?: (
    patch: Partial<PlatformSettingsSnapshot["feedback"]>,
  ) => void;
}

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const SettingsToggleRow = ({
  title,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: SettingsToggleRowProps) => (
  <div className="flex items-start justify-between gap-4">
    <div className="space-y-1">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="text-xs leading-5 text-slate-400">{description}</p>
    </div>
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={title}
      className="mt-0.5"
    />
  </div>
);

export function PlatformSettingsPanel(props: PlatformSettingsPanelProps) {
  if (props.settings) {
    return <PlatformSettingsPanelBody {...props} settings={props.settings} />;
  }

  return (
    <OwnedPlatformSettingsPanel
      className={props.className}
      compact={props.compact}
    />
  );
}

function OwnedPlatformSettingsPanel({
  className,
  compact = false,
}: Pick<PlatformSettingsPanelProps, "className" | "compact">) {
  const { settings, updateAudio, updateAccessibility, updateFeedback } =
    usePlatformSettings();

  return (
    <PlatformSettingsPanelBody
      settings={settings}
      className={className}
      compact={compact}
      onUpdateAudio={updateAudio}
      onUpdateAccessibility={updateAccessibility}
      onUpdateFeedback={updateFeedback}
    />
  );
}

function PlatformSettingsPanelBody({
  settings,
  className,
  compact = false,
  readOnly = false,
  onUpdateAudio,
  onUpdateAccessibility,
  onUpdateFeedback,
}: Required<Pick<PlatformSettingsPanelProps, "settings">> &
  Omit<PlatformSettingsPanelProps, "settings">) {
  const highContrast = settings.accessibility.highContrast;

  return (
    <section
      className={cn(
        "rounded-2xl border bg-black/40 p-4 backdrop-blur-sm sm:p-5",
        highContrast ? "border-white/30" : "border-white/10",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
          Shared settings
        </p>
        <h3 className="text-lg font-semibold text-white">
          Arcade + game defaults
        </h3>
        <p className="max-w-xl text-sm leading-6 text-slate-400">
          Persist locally in the platform and inherit into embedded Air Jam
          games.
        </p>
      </div>

      <div className="mt-4">
        <VolumeControls
          compact={compact}
          values={settings.audio}
          readOnly={readOnly}
          onMasterVolumeChange={(masterVolume) =>
            onUpdateAudio?.({ masterVolume })
          }
          onMusicVolumeChange={(musicVolume) =>
            onUpdateAudio?.({ musicVolume })
          }
          onSfxVolumeChange={(sfxVolume) => onUpdateAudio?.({ sfxVolume })}
        />
      </div>

      <Separator className="my-4 bg-white/10" />

      <div className="space-y-4">
        <SettingsToggleRow
          title="Controller haptics"
          description="Enable local vibration feedback in platform controller surfaces."
          checked={settings.feedback.hapticsEnabled}
          disabled={readOnly}
          onCheckedChange={(checked) =>
            onUpdateFeedback?.({ hapticsEnabled: checked })
          }
        />
        <SettingsToggleRow
          title="Reduced motion"
          description="Prefer simpler platform transitions and fewer movement-heavy animations."
          checked={settings.accessibility.reducedMotion}
          disabled={readOnly}
          onCheckedChange={(checked) =>
            onUpdateAccessibility?.({ reducedMotion: checked })
          }
        />
        <SettingsToggleRow
          title="High contrast"
          description="Increase visual contrast in platform chrome and settings surfaces."
          checked={settings.accessibility.highContrast}
          disabled={readOnly}
          onCheckedChange={(checked) =>
            onUpdateAccessibility?.({ highContrast: checked })
          }
        />
      </div>
    </section>
  );
}
