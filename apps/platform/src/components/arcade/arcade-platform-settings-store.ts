"use client";

import {
  createAirJamStore,
  type AirJamActionContext,
  type PlatformSettingsSnapshot,
} from "@air-jam/sdk";

const DEFAULT_ARCADE_PLATFORM_SETTINGS: PlatformSettingsSnapshot = {
  audio: {
    masterVolume: 1,
    musicVolume: 0.8,
    sfxVolume: 1,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
  },
  feedback: {
    hapticsEnabled: true,
  },
};

export const AIR_JAM_ARCADE_PLATFORM_SETTINGS_STORE_DOMAIN = "arcade.settings";

interface ArcadePlatformSettingsStoreState {
  settings: PlatformSettingsSnapshot;
  actions: {
    setSettings: (
      ctx: AirJamActionContext,
      payload: PlatformSettingsSnapshot,
    ) => void;
  };
}

export const useArcadePlatformSettingsStore =
  createAirJamStore<ArcadePlatformSettingsStoreState>(
    (set) => ({
      settings: DEFAULT_ARCADE_PLATFORM_SETTINGS,
      actions: {
        setSettings: (ctx, payload) => {
          if (ctx.role !== "host") {
            return;
          }
          set({ settings: payload });
        },
      },
    }),
    { storeDomain: AIR_JAM_ARCADE_PLATFORM_SETTINGS_STORE_DOMAIN },
  );
