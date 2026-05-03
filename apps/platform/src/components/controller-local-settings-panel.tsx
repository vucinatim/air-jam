"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ControllerLocalSettingsSnapshot } from "@/lib/controller-local-settings";

interface ControllerLocalSettingsPanelProps {
  className?: string;
  settings: ControllerLocalSettingsSnapshot;
  onUpdateSettings: (patch: Partial<ControllerLocalSettingsSnapshot>) => void;
}

export function ControllerLocalSettingsPanel({
  className,
  settings,
  onUpdateSettings,
}: ControllerLocalSettingsPanelProps) {
  return (
    <section
      className={cn(
        "touch-auto rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
          This controller
        </p>
        <h3 className="text-lg font-semibold text-white">Device settings</h3>
        <p className="max-w-xl text-sm leading-6 text-slate-400">
          Apply only on this controller device.
        </p>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Controller haptics</p>
          <p className="text-xs leading-5 text-slate-400">
            Enable local vibration feedback for this controller.
          </p>
        </div>
        <Switch
          checked={settings.hapticsEnabled}
          onCheckedChange={(checked) =>
            onUpdateSettings({ hapticsEnabled: checked })
          }
          aria-label="Controller haptics"
          className="mt-0.5"
        />
      </div>
    </section>
  );
}
