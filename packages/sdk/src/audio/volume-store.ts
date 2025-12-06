import { create } from "zustand";

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
