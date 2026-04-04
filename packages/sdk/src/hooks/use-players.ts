import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import type { PlayerProfile } from "../protocol";

export const usePlayers = (): PlayerProfile[] => {
  const { store } = useAirJamContext();
  return useStore(
    store,
    useShallow((state) => state.players),
  );
};
