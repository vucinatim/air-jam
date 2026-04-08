import { useMemo } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-scope";
import type {
  ConnectionStatus,
  ControllerOrientation,
  RuntimeState,
  PlayerProfile,
  RoomCode,
} from "../protocol";

export interface AirJamControllerSessionState {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  runtimeState: RuntimeState;
  controllerOrientation: ControllerOrientation;
  stateMessage?: string;
  players: PlayerProfile[];
  selfPlayer: PlayerProfile | null;
}

/**
 * Read controller session state without owning controller runtime side effects.
 *
 * Use this in child UI components that only need to observe the current session.
 * Mount `AirJamControllerRuntime` or `airjam.Controller` once near the top of the controller tree.
 */
export const useControllerSession = (): AirJamControllerSessionState => {
  useAssertSessionScope("controller", "useControllerSession");

  const { store } = useAirJamContext();
  const state = useStore(
    store,
    useShallow((s) => ({
      roomId: s.roomId,
      controllerId: s.controllerId,
      connectionStatus: s.connectionStatus,
      lastError: s.lastError,
      runtimeState: s.runtimeState,
      controllerOrientation: s.controllerOrientation,
      stateMessage: s.stateMessage,
      players: s.players,
    })),
  );

  const selfPlayer = useMemo(
    () =>
      state.controllerId
        ? state.players.find((player) => player.id === state.controllerId) ??
          null
        : null,
    [state.controllerId, state.players],
  );

  return {
    ...state,
    selfPlayer,
  };
};
