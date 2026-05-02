"use client";

import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettingsSnapshot,
} from "@air-jam/sdk";
import { create } from "zustand";

interface ArcadePlatformSettingsStoreState {
  settings: PlatformSettingsSnapshot;
  setSettings: (settings: PlatformSettingsSnapshot) => void;
  resetSettings: () => void;
}

export const useArcadePlatformSettingsStore =
  create<ArcadePlatformSettingsStoreState>((set) => ({
    settings: DEFAULT_PLATFORM_SETTINGS,
    setSettings: (settings) => set({ settings }),
    resetSettings: () => set({ settings: DEFAULT_PLATFORM_SETTINGS }),
  }));

export const setArcadePlatformSettings = (
  settings: PlatformSettingsSnapshot,
): void => {
  useArcadePlatformSettingsStore.getState().setSettings(settings);
};
