import { create } from "zustand";

interface DebugState {
  isOpen: boolean;
  freeFlyMode: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  toggleFreeFly: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  isOpen: false,
  freeFlyMode: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggleFreeFly: () => set((state) => ({ freeFlyMode: !state.freeFlyMode })),
}));
