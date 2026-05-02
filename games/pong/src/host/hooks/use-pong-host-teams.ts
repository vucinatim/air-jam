import { useAirJamHost } from "@air-jam/sdk";
import { useTeamsSnapshot } from "../../game/domain/teams-snapshot";

export const usePongHostTeams = () => {
  const players = useAirJamHost((state) => state.players);
  return useTeamsSnapshot(players, "host");
};
