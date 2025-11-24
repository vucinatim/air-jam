import { create } from "zustand";

export type CollectibleType = "box" | "powerup" | "coin"; // Extensible for future types

export interface CollectibleData {
  id: string;
  type: CollectibleType;
  position: [number, number, number];
  timestamp: number;
}

interface CollectiblesState {
  collectibles: CollectibleData[];
  addCollectible: (collectible: Omit<CollectibleData, "id" | "timestamp">) => string;
  removeCollectible: (id: string) => void;
  clearCollectibles: () => void;
  getCollectibleById: (id: string) => CollectibleData | undefined;
}

export const useCollectiblesStore = create<CollectiblesState>((set, get) => ({
  collectibles: [],
  addCollectible: (collectible) => {
    const id = `collectible-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newCollectible: CollectibleData = {
      ...collectible,
      id,
      timestamp: Date.now(),
    };
    set((state) => ({
      collectibles: [...state.collectibles, newCollectible],
    }));
    return id;
  },
  removeCollectible: (id) =>
    set((state) => ({
      collectibles: state.collectibles.filter((c) => c.id !== id),
    })),
  clearCollectibles: () => set({ collectibles: [] }),
  getCollectibleById: (id) => {
    return get().collectibles.find((c) => c.id === id);
  },
}));

