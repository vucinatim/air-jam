export type PlatformSettingsPersistence = "local" | "none";

export interface PlatformAudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
}

export interface PlatformAccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
}

export interface PlatformFeedbackSettings {
  hapticsEnabled: boolean;
}

export interface PlatformPreviewControllerSettings {
  activeOpacity: number;
}

export interface PlatformSettings {
  audio: PlatformAudioSettings;
  accessibility: PlatformAccessibilitySettings;
  feedback: PlatformFeedbackSettings;
  previewControllers: PlatformPreviewControllerSettings;
}

export type PlatformSettingsSnapshot = PlatformSettings;

export const PLATFORM_SETTINGS_STORAGE_KEY = "air-jam-platform-settings";
export const LEGACY_AUDIO_SETTINGS_STORAGE_KEY = "air-jam-volume-settings";

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsSnapshot = {
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
  previewControllers: {
    activeOpacity: 1,
  },
};

type PartialPlatformAudioSettings = Partial<PlatformAudioSettings>;
type PartialPlatformAccessibilitySettings =
  Partial<PlatformAccessibilitySettings>;
type PartialPlatformFeedbackSettings = Partial<PlatformFeedbackSettings>;
type PartialPlatformPreviewControllerSettings =
  Partial<PlatformPreviewControllerSettings>;

export interface PartialPlatformSettings {
  audio?: PartialPlatformAudioSettings;
  accessibility?: PartialPlatformAccessibilitySettings;
  feedback?: PartialPlatformFeedbackSettings;
  previewControllers?: PartialPlatformPreviewControllerSettings;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const normalizeAudioSettings = (
  value: unknown,
  fallback: PlatformAudioSettings,
): PlatformAudioSettings => {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    masterVolume:
      typeof value.masterVolume === "number"
        ? clamp01(value.masterVolume)
        : fallback.masterVolume,
    musicVolume:
      typeof value.musicVolume === "number"
        ? clamp01(value.musicVolume)
        : fallback.musicVolume,
    sfxVolume:
      typeof value.sfxVolume === "number"
        ? clamp01(value.sfxVolume)
        : fallback.sfxVolume,
  };
};

const normalizePreviewControllerSettings = (
  value: unknown,
  fallback: PlatformPreviewControllerSettings,
): PlatformPreviewControllerSettings => {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    activeOpacity:
      typeof value.activeOpacity === "number"
        ? clamp01(value.activeOpacity)
        : fallback.activeOpacity,
  };
};

export const normalizePlatformSettings = (
  value: unknown,
): PlatformSettingsSnapshot => {
  if (!isRecord(value)) {
    return DEFAULT_PLATFORM_SETTINGS;
  }

  return {
    audio: normalizeAudioSettings(value.audio, DEFAULT_PLATFORM_SETTINGS.audio),
    accessibility: {
      reducedMotion: normalizeBoolean(
        isRecord(value.accessibility)
          ? value.accessibility.reducedMotion
          : null,
        DEFAULT_PLATFORM_SETTINGS.accessibility.reducedMotion,
      ),
      highContrast: normalizeBoolean(
        isRecord(value.accessibility) ? value.accessibility.highContrast : null,
        DEFAULT_PLATFORM_SETTINGS.accessibility.highContrast,
      ),
    },
    feedback: {
      hapticsEnabled: normalizeBoolean(
        isRecord(value.feedback) ? value.feedback.hapticsEnabled : null,
        DEFAULT_PLATFORM_SETTINGS.feedback.hapticsEnabled,
      ),
    },
    previewControllers: normalizePreviewControllerSettings(
      value.previewControllers,
      DEFAULT_PLATFORM_SETTINGS.previewControllers,
    ),
  };
};

export const mergePlatformSettings = (
  current: PlatformSettingsSnapshot,
  patch: PartialPlatformSettings,
): PlatformSettingsSnapshot =>
  normalizePlatformSettings({
    audio: { ...current.audio, ...patch.audio },
    accessibility: {
      ...current.accessibility,
      ...patch.accessibility,
    },
    feedback: { ...current.feedback, ...patch.feedback },
    previewControllers: {
      ...current.previewControllers,
      ...patch.previewControllers,
    },
  });

export const getEffectiveAudioVolume = (
  settings: PlatformAudioSettings,
  category: "music" | "sfx",
): number => {
  const categoryVolume =
    category === "music" ? settings.musicVolume : settings.sfxVolume;
  return clamp01(settings.masterVolume) * clamp01(categoryVolume);
};

const tryParseJson = (raw: string | null): unknown => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const readLegacyAudioSettings = (): PlatformSettingsSnapshot | null => {
  const parsed = tryParseJson(
    window.localStorage.getItem(LEGACY_AUDIO_SETTINGS_STORAGE_KEY),
  );

  if (!isRecord(parsed)) {
    return null;
  }

  return normalizePlatformSettings({
    ...DEFAULT_PLATFORM_SETTINGS,
    audio: {
      masterVolume: parsed.masterVolume,
      musicVolume: parsed.musicVolume,
      sfxVolume: parsed.sfxVolume,
    },
  });
};

export const readPersistedPlatformSettings = (): PlatformSettingsSnapshot => {
  if (typeof window === "undefined") {
    return DEFAULT_PLATFORM_SETTINGS;
  }

  const current = tryParseJson(
    window.localStorage.getItem(PLATFORM_SETTINGS_STORAGE_KEY),
  );
  if (current) {
    return normalizePlatformSettings(current);
  }

  const migrated = readLegacyAudioSettings();
  if (!migrated) {
    return DEFAULT_PLATFORM_SETTINGS;
  }

  try {
    window.localStorage.setItem(
      PLATFORM_SETTINGS_STORAGE_KEY,
      JSON.stringify(migrated),
    );
    window.localStorage.removeItem(LEGACY_AUDIO_SETTINGS_STORAGE_KEY);
  } catch {
    // Best-effort only.
  }

  return migrated;
};

export const persistPlatformSettings = (
  snapshot: PlatformSettingsSnapshot,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PLATFORM_SETTINGS_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Ignore storage failures.
  }
};
