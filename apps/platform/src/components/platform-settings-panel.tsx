"use client";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  PlatformAudioSettings,
  PlatformPreviewControllerSettings,
  PlatformSettingsSnapshot,
  RoomPlatformSettingsSnapshot,
} from "@air-jam/sdk";
import { usePlatformSettings } from "@air-jam/sdk";
import { Slider, VolumeControls } from "@air-jam/sdk/ui";

interface PlatformSettingsPanelProps {
  className?: string;
  compact?: boolean;
  settings?: PlatformSettingsSnapshot | RoomPlatformSettingsSnapshot;
  readOnly?: boolean;
  onUpdateAudio?: (patch: Partial<PlatformAudioSettings>) => void;
  onUpdatePreviewControllers?: (
    patch: Partial<PlatformPreviewControllerSettings>,
  ) => void;
  showPreviewControllerSettings?: boolean;
}

export function PlatformSettingsPanel(props: PlatformSettingsPanelProps) {
  if (props.settings) {
    return <PlatformSettingsPanelBody {...props} settings={props.settings} />;
  }

  return (
    <OwnedPlatformSettingsPanel
      className={props.className}
      compact={props.compact}
      showPreviewControllerSettings={props.showPreviewControllerSettings}
    />
  );
}

function OwnedPlatformSettingsPanel({
  className,
  compact = false,
  showPreviewControllerSettings = false,
}: Pick<
  PlatformSettingsPanelProps,
  "className" | "compact" | "showPreviewControllerSettings"
>) {
  const { settings, updateAudio, updatePreviewControllers } =
    usePlatformSettings();

  return (
    <PlatformSettingsPanelBody
      settings={settings}
      className={className}
      compact={compact}
      onUpdateAudio={updateAudio}
      onUpdatePreviewControllers={updatePreviewControllers}
      showPreviewControllerSettings={showPreviewControllerSettings}
    />
  );
}

function PlatformSettingsPanelBody({
  settings,
  className,
  compact = false,
  readOnly = false,
  onUpdateAudio,
  onUpdatePreviewControllers,
  showPreviewControllerSettings = false,
}: Required<Pick<PlatformSettingsPanelProps, "settings">> &
  Omit<PlatformSettingsPanelProps, "settings">) {
  const highContrast =
    "accessibility" in settings ? settings.accessibility.highContrast : false;

  return (
    <section
      data-testid="platform-settings-panel"
      className={cn(
        "touch-auto rounded-2xl border bg-black/40 p-4 backdrop-blur-sm sm:p-5",
        highContrast ? "border-white/30" : "border-white/10",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
          Room settings
        </p>
        <h3 className="text-lg font-semibold text-white">Audio defaults</h3>
        <p className="max-w-xl text-sm leading-6 text-slate-400">
          Affect the host room and embedded Air Jam game surfaces.
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

      {showPreviewControllerSettings ? (
        <>
          <Separator className="my-4 bg-white/10" />

          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Preview controller opacity
              </p>
              <p className="text-xs leading-5 text-slate-400">
                Control how transparent active on-screen preview controllers are
                so the host surface can stay visible underneath.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-400">Active window</label>
                <span className="font-mono text-xs text-slate-400">
                  {Math.round(settings.previewControllers.activeOpacity * 100)}%
                </span>
              </div>
              <Slider
                data-testid="platform-settings-preview-controller-active-opacity"
                value={[settings.previewControllers.activeOpacity * 100]}
                onValueChange={(values) =>
                  onUpdatePreviewControllers?.({
                    activeOpacity: values[0] / 100,
                  })
                }
                min={35}
                max={100}
                step={1}
                className="w-full"
                aria-label="Preview controller active opacity"
                disabled={readOnly}
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
