import { create } from "zustand";
import { Vector3 } from "three";

export interface LaserData {
  id: string;
  position: [number, number, number];
  direction: Vector3;
  controllerId: string;
  timestamp: number;
}

interface LasersState {
  lasers: LaserData[];
  addLaser: (laser: LaserData) => void;
  removeLaser: (id: string) => void;
  clearLasers: () => void;
}

export const useLasersStore = create<LasersState>((set) => ({
  lasers: [],
  addLaser: (laser) =>
    set((state) => ({
      lasers: [...state.lasers, laser],
    })),
  removeLaser: (id) =>
    set((state) => ({
      lasers: state.lasers.filter((l) => l.id !== id),
    })),
  clearLasers: () => set({ lasers: [] }),
}));


