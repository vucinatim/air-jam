import { create } from "zustand";

interface HealthState {
  health: Record<string, number>; // controllerId -> health value
  isDead: Record<string, boolean>; // controllerId -> is dead
  initializeHealth: (controllerId: string) => void;
  setHealth: (controllerId: string, health: number) => void;
  reduceHealth: (controllerId: string, amount: number) => void;
  getHealth: (controllerId: string) => number;
  removeHealth: (controllerId: string) => void;
  resetAllHealth: () => void;
  checkDeath: (controllerId: string) => boolean; // Returns true if just died
  respawn: (controllerId: string) => void;
  getIsDead: (controllerId: string) => boolean;
}

const MAX_HEALTH = 100;

export const useHealthStore = create<HealthState>((set, get) => ({
  health: {},
  isDead: {},
  initializeHealth: (controllerId: string) => {
    set((state) => {
      if (state.health[controllerId] === undefined) {
        return {
          health: {
            ...state.health,
            [controllerId]: MAX_HEALTH,
          },
          isDead: {
            ...state.isDead,
            [controllerId]: false,
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [controllerId]: healthToRemove, ...restHealth } = state.health;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [controllerId]: deadToRemove, ...restDead } = state.isDead;
      return { health: restHealth, isDead: restDead };
    });
  },
  resetAllHealth: () => {
    set({ health: {}, isDead: {} });
  },
  checkDeath: (controllerId: string) => {
    const currentHealth = get().health[controllerId] ?? MAX_HEALTH;
    const wasDead = get().isDead[controllerId] ?? false;

    if (currentHealth <= 0 && !wasDead) {
      // Just died
      set((state) => ({
        isDead: {
          ...state.isDead,
          [controllerId]: true,
        },
      }));
      return true;
    }
    return false;
  },
  respawn: (controllerId: string) => {
    set((state) => ({
      health: {
        ...state.health,
        [controllerId]: MAX_HEALTH,
      },
      isDead: {
        ...state.isDead,
        [controllerId]: false,
      },
    }));
  },
  getIsDead: (controllerId: string) => {
    return get().isDead[controllerId] ?? false;
  },
}));
