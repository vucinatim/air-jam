import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-scope";
import type {
  ConnectionStatus,
  RuntimeState,
  PlayerProfile,
  RoomCode,
  RunMode,
} from "../protocol";

export interface AirJamHostSessionState {
  roomId: RoomCode | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  players: PlayerProfile[];
  mode: RunMode;
  runtimeState: RuntimeState;
}

/**
 * Read host session state without owning host runtime side effects.
 *
 * Use this in child UI components that only need current host session state.
 * Mount `AirJamHostRuntime` or `airjam.Host` once near the top of the host tree.
 */
export const useHostSession = (): AirJamHostSessionState => {
  useAssertSessionScope("host", "useHostSession");

  const { store } = useAirJamContext();
  return useStore(
    store,
    useShallow((s) => ({
      roomId: s.roomId,
      connectionStatus: s.connectionStatus,
      lastError: s.lastError,
      players: s.players,
      mode: s.mode,
      runtimeState: s.runtimeState,
    })),
  );
};
