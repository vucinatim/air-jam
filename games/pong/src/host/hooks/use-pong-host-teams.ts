import { useAirJamHost } from "@air-jam/sdk";
import { gameInputSchema } from "../../game/contracts/input";
import { useTeamsSnapshot } from "../../game/domain/teams-snapshot";

export const usePongHostTeams = () => {
  const host = useAirJamHost<typeof gameInputSchema>();
  return useTeamsSnapshot(host.players, "host");
};
