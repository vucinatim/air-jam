import { useStore } from "zustand";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-providers";
import type { AirJamStore } from "../state/connection-store";

export const useAirJamControllerState = <T>(
  selector: (state: AirJamStore) => T,
): T => {
  useAssertSessionScope("controller", "useAirJamControllerState");

  const { store } = useAirJamContext();
  return useStore(store, selector);
};
