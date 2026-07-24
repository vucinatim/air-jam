import { type ConnectedPlayer } from "@/game/stores";
import { type PlayerProfile } from "@air-jam/sdk";
import { useEffect, useMemo } from "react";

interface HostPlayerSyncActions {
  setPlayers: (payload: { players: ConnectedPlayer[] }) => void;
}

export const useHostPlayerSync = (
  players: PlayerProfile[],
  actions: HostPlayerSyncActions,
  enabled: boolean,
) => {
  const playersForStore = useMemo(
    () => players.map((player) => ({ id: player.id, label: player.label })),
    [players],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    actions.setPlayers({ players: playersForStore });
  }, [actions, enabled, playersForStore]);
};
