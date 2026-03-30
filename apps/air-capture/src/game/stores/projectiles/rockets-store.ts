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
  addRocket: (rocket: RocketData) => void;
  removeRocket: (id: string) => void;
  clearRockets: () => void;
}

export const useRocketsStore = create<RocketsState>((set) => ({
  rockets: [],
  addRocket: (rocket) =>
    set((state) => ({
      rockets: [...state.rockets, rocket],
    })),
  removeRocket: (id) =>
    set((state) => ({
      rockets: state.rockets.filter((r) => r.id !== id),
    })),
  clearRockets: () => set({ rockets: [] }),
}));
