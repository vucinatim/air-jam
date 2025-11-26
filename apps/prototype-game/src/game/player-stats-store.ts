import { create } from "zustand";

/**
 * Player stats store - stores ability-modifiable player stats
 * Abilities modify these values directly, Ship reads them
 */
interface PlayerStats {
  speedMultiplier: number;
  accelerationMultiplier: number;
  // Add more stats as needed (damageMultiplier, etc.)
}

interface PlayerStatsState {
  stats: Record<string, PlayerStats>; // controllerId -> stats
  initializeStats: (controllerId: string) => void;
  setSpeedMultiplier: (controllerId: string, multiplier: number) => void;
  setAccelerationMultiplier: (controllerId: string, multiplier: number) => void;
  resetStats: (controllerId: string) => void;
  removeStats: (controllerId: string) => void;
  getSpeedMultiplier: (controllerId: string) => number;
  getAccelerationMultiplier: (controllerId: string) => number;
}

const DEFAULT_STATS: PlayerStats = {
  speedMultiplier: 1.0,
  accelerationMultiplier: 1.0,
};

export const usePlayerStatsStore = create<PlayerStatsState>((set, get) => ({
  stats: {},
  initializeStats: (controllerId: string) => {
    set((state) => {
      if (state.stats[controllerId] === undefined) {
        return {
          stats: {
            ...state.stats,
            [controllerId]: { ...DEFAULT_STATS },
          },
        };
      }
      return state;
    });
  },
  setSpeedMultiplier: (controllerId: string, multiplier: number) => {
    set((state) => ({
      stats: {
        ...state.stats,
        [controllerId]: {
          ...(state.stats[controllerId] ?? { ...DEFAULT_STATS }),
          speedMultiplier: multiplier,
        },
      },
    }));
  },
  setAccelerationMultiplier: (controllerId: string, multiplier: number) => {
    set((state) => ({
      stats: {
        ...state.stats,
        [controllerId]: {
          ...(state.stats[controllerId] ?? { ...DEFAULT_STATS }),
          accelerationMultiplier: multiplier,
        },
      },
    }));
  },
  resetStats: (controllerId: string) => {
    set((state) => ({
      stats: {
        ...state.stats,
        [controllerId]: { ...DEFAULT_STATS },
      },
    }));
  },
  removeStats: (controllerId: string) => {
    set((state) => {
      const { [controllerId]: _, ...rest } = state.stats;
      return { stats: rest };
    });
  },
  getSpeedMultiplier: (controllerId: string) => {
    return get().stats[controllerId]?.speedMultiplier ?? 1.0;
  },
  getAccelerationMultiplier: (controllerId: string) => {
    return get().stats[controllerId]?.accelerationMultiplier ?? 1.0;
  },
}));




