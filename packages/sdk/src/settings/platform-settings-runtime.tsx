import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol";
import { emitAirJamDevRuntimeEvent } from "../runtime/dev-runtime-events";
import {
  DEFAULT_PLATFORM_SETTINGS,
  LEGACY_AUDIO_SETTINGS_STORAGE_KEY,
  mergePlatformSettings,
  PLATFORM_SETTINGS_STORAGE_KEY,
  persistPlatformSettings,
  readPersistedPlatformSettings,
  type PartialPlatformSettings,
  type PlatformAudioSettings,
  type PlatformSettingsPersistence,
  type PlatformSettingsSnapshot,
  getEffectiveAudioVolume,
} from "./platform-settings";
import { initializeInheritedPlatformSettingsBridge } from "./platform-settings-bridge";

type PlatformSettingsMode = "owner" | "inherited" | "default";

interface PlatformSettingsContextValue {
  mode: PlatformSettingsMode;
  settings: PlatformSettingsSnapshot;
  setSettings: (
    next:
      | PlatformSettingsSnapshot
      | ((current: PlatformSettingsSnapshot) => PlatformSettingsSnapshot),
  ) => void;
  updateSettings: (patch: PartialPlatformSettings) => void;
}

const platformSettingsContext =
  createContext<PlatformSettingsContextValue | null>(null);

export interface PlatformSettingsRuntimeProps {
  children: ReactNode;
  persistence?: PlatformSettingsPersistence;
}

export interface PlatformSettingsOwnerApi {
  settings: PlatformSettingsSnapshot;
  setSettings: (
    next:
      | PlatformSettingsSnapshot
      | ((current: PlatformSettingsSnapshot) => PlatformSettingsSnapshot),
  ) => void;
  updateSettings: (patch: PartialPlatformSettings) => void;
  updateAudio: (patch: Partial<PlatformAudioSettings>) => void;
  updateAccessibility: (
    patch: Partial<PlatformSettingsSnapshot["accessibility"]>,
  ) => void;
  updateFeedback: (
    patch: Partial<PlatformSettingsSnapshot["feedback"]>,
  ) => void;
}

export interface PlatformAudioSettingsApi extends PlatformAudioSettings {
  getEffectiveVolume: (category: "music" | "sfx") => number;
  isReadOnly: boolean;
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
}

const getInitialMode = (
  persistence: PlatformSettingsPersistence,
): PlatformSettingsMode => {
  if (typeof window === "undefined") {
    return persistence === "local" ? "owner" : "default";
  }

  if (window.parent !== window) {
    return "inherited";
  }

  return persistence === "local" ? "owner" : "default";
};

const createDefaultContextValue = (): PlatformSettingsContextValue => ({
  mode: "default",
  settings: DEFAULT_PLATFORM_SETTINGS,
  setSettings: () => {
    throw new Error(
      "Platform settings are read-only in this runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell to update shared settings.",
    );
  },
  updateSettings: () => {
    throw new Error(
      "Platform settings are read-only in this runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell to update shared settings.",
    );
  },
});

export function PlatformSettingsRuntime({
  children,
  persistence = "none",
}: PlatformSettingsRuntimeProps) {
  const mode = getInitialMode(persistence);
  const [settings, setSettingsState] = useState<PlatformSettingsSnapshot>(() =>
    mode === "owner" ? readPersistedPlatformSettings() : DEFAULT_PLATFORM_SETTINGS,
  );

  useEffect(() => {
    if (mode === "owner") {
      setSettingsState(readPersistedPlatformSettings());
      return;
    }

    setSettingsState(DEFAULT_PLATFORM_SETTINGS);
  }, [mode]);

  useEffect(() => {
    if (mode !== "owner") {
      return;
    }

    persistPlatformSettings(settings);
  }, [mode, settings]);

  useEffect(() => {
    if (mode !== "owner" || typeof window === "undefined") {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (
        event.key !== null &&
        event.key !== PLATFORM_SETTINGS_STORAGE_KEY &&
        event.key !== LEGACY_AUDIO_SETTINGS_STORAGE_KEY
      ) {
        return;
      }

      setSettingsState(readPersistedPlatformSettings());
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "inherited") {
      return;
    }

    return initializeInheritedPlatformSettingsBridge({
      applySettings: setSettingsState,
      onBridgeAttached: (origin) => {
        emitAirJamDevRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
          message: "Embedded runtime bound platform settings bridge port",
          level: "info",
          data: {
            origin,
            state: "waiting_ready",
            transport: "bridge_port",
          },
        });
      },
      onSettingsReadyRequested: (trustedParentOrigin) => {
        emitAirJamDevRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
          message: "Embedded runtime requested initial platform settings from parent",
          level: "info",
          data: {
            trustedParentOrigin,
            state: "waiting_ready",
          },
        });
      },
      onSnapshotApplied: (transport, settings) => {
        emitAirJamDevRuntimeEvent({
          event: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
          message: "Embedded runtime applied platform settings snapshot",
          level: "info",
          data: {
            transport,
            state: "ready",
            settings,
          },
        });
      },
    });
  }, [mode]);

  const setSettings = useCallback<
    PlatformSettingsContextValue["setSettings"]
  >((next) => {
    if (mode !== "owner") {
      throw new Error(
        "Platform settings are read-only in this runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell to update shared settings.",
      );
    }

    setSettingsState((current) =>
      typeof next === "function" ? next(current) : next,
    );
  }, [mode]);

  const updateSettings = useCallback<PlatformSettingsContextValue["updateSettings"]>(
    (patch) => {
      if (mode !== "owner") {
        throw new Error(
          "Platform settings are read-only in this runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell to update shared settings.",
        );
      }

      setSettingsState((current) => mergePlatformSettings(current, patch));
    },
    [mode],
  );

  const value = useMemo<PlatformSettingsContextValue>(
    () => ({
      mode,
      settings,
      setSettings,
      updateSettings,
    }),
    [mode, settings, setSettings, updateSettings],
  );

  return (
    <platformSettingsContext.Provider value={value}>
      {children}
    </platformSettingsContext.Provider>
  );
}

export function usePlatformSettings(): PlatformSettingsOwnerApi {
  const context = useContext(platformSettingsContext);

  if (!context) {
    throw new Error(
      "usePlatformSettings must be used within a PlatformSettingsRuntime",
    );
  }

  if (context.mode !== "owner") {
    throw new Error(
      "usePlatformSettings can only be used in a platform-owned settings runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell.",
    );
  }

  return {
    settings: context.settings,
    setSettings: context.setSettings,
    updateSettings: context.updateSettings,
    updateAudio: (patch) => context.updateSettings({ audio: patch }),
    updateAccessibility: (patch) =>
      context.updateSettings({ accessibility: patch }),
    updateFeedback: (patch) => context.updateSettings({ feedback: patch }),
  };
}

export function useInheritedPlatformSettings(): Readonly<PlatformSettingsSnapshot> {
  const context = useContext(platformSettingsContext);

  if (!context) {
    throw new Error(
      "useInheritedPlatformSettings must be used within a PlatformSettingsRuntime",
    );
  }

  return context.settings;
}

export function usePlatformAudioSettings(): PlatformAudioSettingsApi {
  const context = useContext(platformSettingsContext) ?? createDefaultContextValue();
  const { audio } = context.settings;
  const isReadOnly = context.mode !== "owner";

  const setAudioSetting = useCallback(
    (patch: Partial<PlatformAudioSettings>) => {
      if (context.mode !== "owner") {
        throw new Error(
          "Platform audio settings are read-only in this runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell to update shared settings.",
        );
      }

      context.updateSettings({ audio: patch });
    },
    [context],
  );

  return {
    ...audio,
    isReadOnly,
    getEffectiveVolume: (category) => getEffectiveAudioVolume(audio, category),
    setMasterVolume: (volume) => setAudioSetting({ masterVolume: volume }),
    setMusicVolume: (volume) => setAudioSetting({ musicVolume: volume }),
    setSfxVolume: (volume) => setAudioSetting({ sfxVolume: volume }),
  };
}

export function useResolvedPlatformSettingsSnapshot(): PlatformSettingsSnapshot {
  return useContext(platformSettingsContext)?.settings ?? DEFAULT_PLATFORM_SETTINGS;
}
