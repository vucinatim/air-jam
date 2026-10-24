import { useAirJamHost, type AirJamHostApi } from "@air-jam/sdk";
import { useHostJoinControls } from "@air-jam/sdk/ui";
import { useCallback, useMemo } from "react";
import {
  spaceStore,
  useOfficeMatchPhase,
  useOfficeSelectedPlayerCount,
} from "../../game/stores";

export type OfficeHostApi = AirJamHostApi;

export interface OfficeHostSession {
  host: OfficeHostApi;
  players: OfficeHostApi["players"];
  playerIds: string[];
  roomId: string | null;
  connectionStatus: OfficeHostApi["connectionStatus"];
  runtimeState: OfficeHostApi["runtimeState"];
  matchPhase: ReturnType<typeof useOfficeMatchPhase>;
  selectedCount: number;
  canStartMatch: boolean;
  joinControls: ReturnType<typeof useHostJoinControls>;
  startMatch: () => void;
  returnToLobby: () => void;
  storeActions: typeof spaceStore.actions;
}

export function useOfficeHostSession(): OfficeHostSession {
  const host = useAirJamHost();
  const players = useAirJamHost((state) => state.players);
  const roomId = useAirJamHost((state) => state.roomId);
  const connectionStatus = useAirJamHost((state) => state.connectionStatus);
  const runtimeState = useAirJamHost((state) => state.runtimeState);
  const matchPhase = useOfficeMatchPhase();
  const storeActions = spaceStore.actions;

  const playerIds = useMemo(
    () => players.map((player) => player.id),
    [players],
  );
  const selectedCount = useOfficeSelectedPlayerCount(playerIds);

  const canStartMatch =
    matchPhase === "lobby" &&
    selectedCount > 0 &&
    selectedCount === playerIds.length &&
    connectionStatus === "connected";

  const startMatch = useCallback(() => {
    if (!canStartMatch) {
      return;
    }

    storeActions.startMatch();
  }, [canStartMatch, storeActions]);

  const returnToLobby = useCallback(() => {
    storeActions.returnToLobby();
  }, [storeActions]);

  const joinControls = useHostJoinControls({
    joinUrl: host.joinUrl,
    canStartMatch,
    onStartMatch: startMatch,
  });

  return {
    host,
    players,
    playerIds,
    roomId,
    connectionStatus,
    runtimeState,
    matchPhase,
    selectedCount,
    canStartMatch,
    joinControls,
    startMatch,
    returnToLobby,
    storeActions,
  };
}
