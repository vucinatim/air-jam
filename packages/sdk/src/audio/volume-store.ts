import { create } from "zustand";
import { getRuntimeUrlOrigin } from "../protocol/url-policy";
import {
  isAirJamSettingsSyncMessage,
  parseAirJamBridgeInitMessage,
} from "../runtime/iframe-bridge";

interface VolumeSettings {
  masterVolume: number; // 0-1
  musicVolume: number; // 0-1
  sfxVolume: number; // 0-1
  setMasterVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  getEffectiveVolume: (category: "music" | "sfx") => number;
}

const STORAGE_KEY = "air-jam-volume-settings";

// Load initial state from localStorage
const loadFromStorage = (): Partial<VolumeSettings> => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        masterVolume: parsed.masterVolume ?? 1.0,
        musicVolume: parsed.musicVolume ?? 0.8,
        sfxVolume: parsed.sfxVolume ?? 1.0,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {};
};

// Save to localStorage
const saveToStorage = (state: VolumeSettings) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        masterVolume: state.masterVolume,
        musicVolume: state.musicVolume,
        sfxVolume: state.sfxVolume,
      }),
    );
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
};

const initialValues = loadFromStorage();

let parentSettingsListenerCleanup: (() => void) | null = null;
let bridgePortCleanup: (() => void) | null = null;

export const useVolumeStore = create<VolumeSettings>((set, get) => ({
  masterVolume: initialValues.masterVolume ?? 1.0,
  musicVolume: initialValues.musicVolume ?? 0.8,
  sfxVolume: initialValues.sfxVolume ?? 1.0,
  setMasterVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ masterVolume: clamped });
    saveToStorage({ ...get(), masterVolume: clamped });
  },
  setMusicVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ musicVolume: clamped });
    saveToStorage({ ...get(), musicVolume: clamped });
  },
  setSfxVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ sfxVolume: clamped });
    saveToStorage({ ...get(), sfxVolume: clamped });
  },
  getEffectiveVolume: (category) => {
    const { masterVolume, musicVolume, sfxVolume } = get();
    const categoryVolume = category === "music" ? musicVolume : sfxVolume;
    return masterVolume * categoryVolume;
  },
}));

/**
 * Initialize parent settings sync for child mode (games running in arcade iframe).
 * This is intentionally explicit and must be called by a runtime adapter.
 */
export const initializeParentSettingsSync = () => {
  if (parentSettingsListenerCleanup) {
    return;
  }

  if (typeof window === "undefined") return;

  const isInIframe = window.parent !== window;
  if (!isInIframe) return;

  const trustedParentOrigin = getRuntimeUrlOrigin(document.referrer);
  if (!trustedParentOrigin) {
    console.warn(
      "[AirJamVolume] Parent settings sync disabled: unable to resolve trusted parent origin.",
    );
    return;
  }

  const applySyncedSettings = (payload: {
    masterVolume?: number;
    musicVolume?: number;
    sfxVolume?: number;
  }) => {
    // Apply settings without saving to localStorage (arcade owns the settings)
    const store = useVolumeStore.getState();

    // Use setters to trigger AudioManager subscription updates
    const { masterVolume, musicVolume, sfxVolume } = payload;
    if (typeof masterVolume === "number") store.setMasterVolume(masterVolume);
    if (typeof musicVolume === "number") store.setMusicVolume(musicVolume);
    if (typeof sfxVolume === "number") store.setSfxVolume(sfxVolume);
  };

  const bindBridgePort = (port: MessagePort) => {
    bridgePortCleanup?.();

    const handlePortMessage = (event: MessageEvent<unknown>) => {
      if (!isAirJamSettingsSyncMessage(event.data)) return;
      applySyncedSettings(event.data.payload);
    };

    port.addEventListener("message", handlePortMessage as EventListener);
    port.start();

    bridgePortCleanup = () => {
      port.removeEventListener("message", handlePortMessage as EventListener);
      try {
        port.close();
      } catch {
        // Ignore close errors
      }
      bridgePortCleanup = null;
    };
  };

  const handleInitMessage = (event: MessageEvent<unknown>) => {
    if (event.source !== window.parent) return;
    if (event.origin !== trustedParentOrigin) return;

    const initMessage = parseAirJamBridgeInitMessage(event.data);
    if (!initMessage) return;

    const bridgePort = event.ports?.[0];
    if (!bridgePort) return;

    bindBridgePort(bridgePort);
  };

  const handleLegacySettingsMessage = (event: MessageEvent<unknown>) => {
    // Only accept settings sync messages from parent
    if (event.source !== window.parent) return;
    if (event.origin !== trustedParentOrigin) return;
    if (!isAirJamSettingsSyncMessage(event.data)) return;
    applySyncedSettings(event.data.payload);
  };

  window.addEventListener("message", handleInitMessage);
  window.addEventListener("message", handleLegacySettingsMessage);
  parentSettingsListenerCleanup = () => {
    window.removeEventListener("message", handleInitMessage);
    window.removeEventListener("message", handleLegacySettingsMessage);
    bridgePortCleanup?.();
    parentSettingsListenerCleanup = null;
  };
};

export const disposeParentSettingsSync = () => {
  parentSettingsListenerCleanup?.();
};
