import { createStore } from "zustand/vanilla";

export interface ControllerState {
  vector: { x: number; y: number };
  ability: boolean;
  action: boolean;
}

export interface ControllerActions {
  setVector: (vector: { x: number; y: number }) => void;
  setAbility: (active: boolean) => void;
  setAction: (active: boolean) => void;
  reset: () => void;
}

export type ControllerStore = ControllerState & ControllerActions;

export const createControllerStore = () => {
  return createStore<ControllerStore>((set) => ({
    vector: { x: 0, y: 0 },
    ability: false,
    action: false,
    setVector: (vector) => set({ vector }),
    setAbility: (ability) => set({ ability }),
    setAction: (action) => set({ action }),
    reset: () =>
      set({
        vector: { x: 0, y: 0 },
        ability: false,
        action: false,
      }),
  }));
};
