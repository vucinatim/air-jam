import { type ConnectedPlayer } from "@/game/stores";
import { type PlayerProfile } from "@air-jam/sdk";
import { useEffect, useMemo } from "react";

interface HostPlayerSyncActions {
  setPlayers: (payload: { players: ConnectedPlayer[] }) => void;
}

export const useHostPlayerSync = (
  players: PlayerProfile[],
  actions: HostPlayerSyncActions,
) => {
  const playersForStore = useMemo(
    () => players.map((player) => ({ id: player.id, label: player.label })),
    [players],
  );

  useEffect(() => {
    actions.setPlayers({ players: playersForStore });
  }, [actions, playersForStore]);
};
