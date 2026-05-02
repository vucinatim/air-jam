import { useStore } from "zustand";
import { useAirJamContext } from "../context/air-jam-context";
import type { ConnectionStatus } from "../protocol";

export const useConnectionStatus = (): ConnectionStatus => {
  const { store } = useAirJamContext();
  return useStore(store, (state) => state.connectionStatus);
};
