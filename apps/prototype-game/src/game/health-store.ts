import { create } from "zustand";

interface HealthState {
  health: Record<string, number>; // controllerId -> health value
  initializeHealth: (controllerId: string) => void;
  setHealth: (controllerId: string, health: number) => void;
  reduceHealth: (controllerId: string, amount: number) => void;
  getHealth: (controllerId: string) => number;
  removeHealth: (controllerId: string) => void;
  resetAllHealth: () => void;
}

const MAX_HEALTH = 100;

export const useHealthStore = create<HealthState>((set, get) => ({
  health: {},
  initializeHealth: (controllerId: string) => {
    set((state) => {
      if (state.health[controllerId] === undefined) {
        return {
          health: {
            ...state.health,
            [controllerId]: MAX_HEALTH,
          },
        };
      }
      return state;
    });
  },
  setHealth: (controllerId: string, health: number) => {
    set((state) => ({
      health: {
        ...state.health,
        [controllerId]: Math.max(0, Math.min(MAX_HEALTH, health)),
      },
    }));
  },
  reduceHealth: (controllerId: string, amount: number) => {
    const currentHealth = get().health[controllerId] ?? MAX_HEALTH;
    const newHealth = Math.max(0, currentHealth - amount);
    set((state) => ({
      health: {
        ...state.health,
        [controllerId]: newHealth,
      },
    }));
  },
  getHealth: (controllerId: string) => {
    return get().health[controllerId] ?? MAX_HEALTH;
  },
  removeHealth: (controllerId: string) => {
    set((state) => {
      const { [controllerId]: _, ...rest } = state.health;
      return { health: rest };
    });
  },
  resetAllHealth: () => {
    set({ health: {} });
  },
}));

