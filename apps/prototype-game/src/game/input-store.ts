import type { ControllerInputEvent } from "@air-jam/sdk";
import { create } from "zustand";

export interface InputState {
  vector: { x: number; y: number };
  action: boolean;
  ability: boolean;
  timestamp: number;
}

interface InputUpdate {
  controllerId: string;
  input: Record<string, unknown>; // Arbitrary input structure
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

      // Extract input fields with type safety
      // This game expects: { vector: {x, y}, action: boolean, ability?: boolean, timestamp?: number }
      const input = event.input;

      // Type guards for safe extraction
      const getVector = (): { x: number; y: number } => {
        if (
          input.vector &&
          typeof input.vector === "object" &&
          !Array.isArray(input.vector) &&
          typeof (input.vector as { x?: unknown }).x === "number" &&
          typeof (input.vector as { y?: unknown }).y === "number"
        ) {
          return input.vector as { x: number; y: number };
        }
        return previousInput?.vector ?? { x: 0, y: 0 };
      };

      const getAction = (): boolean => {
        return typeof input.action === "boolean" ? input.action : false;
      };

      const getAbility = (): boolean => {
        if (typeof input.ability === "boolean") {
          return input.ability;
        }
        // Preserve current ability state if undefined
        return previousInput?.ability ?? false;
      };

      const getTimestamp = (): number => {
        return typeof input.timestamp === "number"
          ? input.timestamp
          : Date.now();
      };

      newInputs.set(event.controllerId, {
        vector: getVector(),
        action: getAction(),
        ability: getAbility(),
        timestamp: getTimestamp(),
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
