import { create } from "zustand";

export type FlightMode = "grounded" | "airborne";

export interface PlayerFlightState {
  mode: FlightMode;
  airControlEnergy: number;
  isAirControlDepleted: boolean;
}

interface FlightStateStore {
  flightStates: Record<string, PlayerFlightState>;
  getFlightState: (controllerId: string) => PlayerFlightState;
  initializeFlightState: (controllerId: string) => void;
  setFlightState: (
    controllerId: string,
    nextState: Partial<PlayerFlightState>,
  ) => void;
  removeFlightState: (controllerId: string) => void;
}

const DEFAULT_FLIGHT_STATE: PlayerFlightState = {
  mode: "grounded",
  airControlEnergy: 1,
  isAirControlDepleted: false,
};

export const useFlightStateStore = create<FlightStateStore>((set, get) => ({
  flightStates: {},

  getFlightState: (controllerId) =>
    get().flightStates[controllerId] ?? DEFAULT_FLIGHT_STATE,

  initializeFlightState: (controllerId) => {
    set((state) => {
      if (state.flightStates[controllerId]) {
        return state;
      }

      return {
        flightStates: {
          ...state.flightStates,
          [controllerId]: { ...DEFAULT_FLIGHT_STATE },
        },
      };
    });
  },

  setFlightState: (controllerId, nextState) => {
    set((state) => {
      const current = state.flightStates[controllerId] ?? DEFAULT_FLIGHT_STATE;
      const merged: PlayerFlightState = {
        ...current,
        ...nextState,
      };

      const sameMode = merged.mode === current.mode;
      const sameEnergy = merged.airControlEnergy === current.airControlEnergy;
      const sameDepleted =
        merged.isAirControlDepleted === current.isAirControlDepleted;

      if (sameMode && sameEnergy && sameDepleted) {
        return state;
      }

      return {
        flightStates: {
          ...state.flightStates,
          [controllerId]: merged,
        },
      };
    });
  },

  removeFlightState: (controllerId) => {
    set((state) => {
      const rest = { ...state.flightStates };
      delete rest[controllerId];
      return { flightStates: rest };
    });
  },
}));
