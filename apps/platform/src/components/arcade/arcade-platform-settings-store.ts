"use client";

import {
  createAirJamStore,
  type AirJamActionContext,
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettingsSnapshot,
} from "@air-jam/sdk";

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
      settings: DEFAULT_PLATFORM_SETTINGS,
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
