import { Vector3 } from "three";
import { create } from "zustand";

export interface RocketData {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
  timestamp: number;
}

interface RocketsState {
  rockets: RocketData[];
  activeRocketIdsByController: Record<string, string>;
  detonationRequests: Record<string, true>;
  addRocket: (rocket: RocketData) => void;
  removeRocket: (id: string) => void;
  getActiveRocketId: (controllerId: string) => string | null;
  requestDetonateRocket: (id: string) => void;
  consumeDetonationRequest: (id: string) => boolean;
  clearRockets: () => void;
}

export const useRocketsStore = create<RocketsState>((set, get) => ({
  rockets: [],
  activeRocketIdsByController: {},
  detonationRequests: {},
  addRocket: (rocket) =>
    set((state) => ({
      rockets: [...state.rockets, rocket],
      activeRocketIdsByController: {
        ...state.activeRocketIdsByController,
        [rocket.controllerId]: rocket.id,
      },
    })),
  removeRocket: (id) =>
    set((state) => {
      const rocketToRemove = state.rockets.find((rocket) => rocket.id === id);
      const nextActiveRocketIdsByController = {
        ...state.activeRocketIdsByController,
      };
      const nextDetonationRequests = { ...state.detonationRequests };

      if (
        rocketToRemove &&
        nextActiveRocketIdsByController[rocketToRemove.controllerId] === id
      ) {
        delete nextActiveRocketIdsByController[rocketToRemove.controllerId];
      }
      delete nextDetonationRequests[id];

      return {
        rockets: state.rockets.filter((r) => r.id !== id),
        activeRocketIdsByController: nextActiveRocketIdsByController,
        detonationRequests: nextDetonationRequests,
      };
    }),
  getActiveRocketId: (controllerId): string | null =>
    get().activeRocketIdsByController[controllerId] ?? null,
  requestDetonateRocket: (id) =>
    set((state) => ({
      detonationRequests: {
        ...state.detonationRequests,
        [id]: true,
      },
    })),
  consumeDetonationRequest: (id) => {
    const requested = get().detonationRequests[id] === true;

    if (requested) {
      set((state) => {
        const nextDetonationRequests = { ...state.detonationRequests };
        delete nextDetonationRequests[id];
        return { detonationRequests: nextDetonationRequests };
      });
    }

    return requested;
  },
  clearRockets: () =>
    set({
      rockets: [],
      activeRocketIdsByController: {},
      detonationRequests: {},
    }),
}));
