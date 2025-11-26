import { create } from "zustand";
import type { ControllerInputEvent } from "@air-jam/sdk";

export interface InputState {
  vector: { x: number; y: number };
  action: boolean;
  ability: boolean;
  timestamp: number;
}

interface InputUpdate {
  controllerId: string;
  input: {
    vector: { x: number; y: number };
    action: boolean;
    ability?: boolean;
    timestamp?: number;
  };
}

interface InputStore {
  inputs: Map<string, InputState>;
  getInput: (controllerId: string) => InputState | undefined;
  applyInput: (event: ControllerInputEvent | InputUpdate) => void;
  clearInput: (controllerId: string) => void;
  clearAllInputs: () => void;
  removeInput: (controllerId: string) => void;
}

const createEmptyInput = (): InputState => ({
  vector: { x: 0, y: 0 },
  action: false,
  ability: false,
  timestamp: Date.now(),
});

export const useInputStore = create<InputStore>((set, get) => ({
  inputs: new Map(),
  getInput: (controllerId) => {
    return get().inputs.get(controllerId);
  },
  applyInput: (event) => {
    set((state) => {
      const newInputs = new Map(state.inputs);
      const previousInput = state.inputs.get(event.controllerId);

      // Preserve current ability state if undefined, don't default to false
      // This prevents losing state between updates
      const newAbilityState =
        event.input.ability ?? previousInput?.ability ?? false;

      newInputs.set(event.controllerId, {
        vector: event.input.vector,
        action: event.input.action,
        ability: newAbilityState,
        timestamp: event.input.timestamp ?? Date.now(),
      });
      return { inputs: newInputs };
    });
  },
  clearInput: (controllerId) => {
    set((state) => {
      const newInputs = new Map(state.inputs);
      const existing = newInputs.get(controllerId);
      if (existing) {
        newInputs.set(controllerId, {
          ...createEmptyInput(),
          timestamp: Date.now(),
        });
      }
      return { inputs: newInputs };
    });
  },
  clearAllInputs: () => {
    const now = Date.now();
    set((state) => {
      const newInputs = new Map(state.inputs);
      newInputs.forEach((_, controllerId) => {
        newInputs.set(controllerId, {
          ...createEmptyInput(),
          timestamp: now,
        });
      });
      return { inputs: newInputs };
    });
  },
  removeInput: (controllerId) => {
    set((state) => {
      const newInputs = new Map(state.inputs);
      newInputs.delete(controllerId);
      return { inputs: newInputs };
    });
  },
}));
