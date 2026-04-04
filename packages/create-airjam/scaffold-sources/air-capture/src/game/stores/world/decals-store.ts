import { Vector3 } from "three";
import { create } from "zustand";

export interface DecalData {
  id: string;
  position: [number, number, number];
  normal: Vector3;
  timestamp: number;
}

interface DecalsState {
  decals: DecalData[];
  addDecal: (decal: Omit<DecalData, "id" | "timestamp">) => void;
  removeDecal: (id: string) => void;
  clearDecals: () => void;
}

export const useDecalsStore = create<DecalsState>((set) => ({
  decals: [],
  addDecal: (decal) =>
    set((state) => {
      const id = `decal-${Date.now()}-${Math.random()}`;
      const timestamp = Date.now();
      return {
        decals: [...state.decals, { ...decal, id, timestamp }],
      };
    }),
  removeDecal: (id) =>
    set((state) => ({
      decals: state.decals.filter((d) => d.id !== id),
    })),
  clearDecals: () => set({ decals: [] }),
}));
