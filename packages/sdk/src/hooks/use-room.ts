import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import type { RoomCode } from "../protocol";

export interface RoomState {
  roomId: RoomCode | null;
  gameState: "paused" | "playing";
  mode: "standalone" | "platform";
}

export const useRoom = (): RoomState => {
  const { store } = useAirJamContext();
  return useStore(
    store,
    useShallow((state) => ({
      roomId: state.roomId,
      gameState: state.gameState,
      mode: state.mode,
    })),
  );
};
