import { useStore } from "zustand";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-providers";
import type { AirJamStore } from "../state/connection-store";

export const useAirJamHostState = <T>(
  selector: (state: AirJamStore) => T,
): T => {
  useAssertSessionScope("host", "useAirJamHostState");

  const { store } = useAirJamContext();
  return useStore(store, selector);
};
