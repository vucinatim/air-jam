import { useAirJamHost } from "@air-jam/sdk";
import { gameInputSchema } from "../game/input";
import { useTeamsSnapshot } from "../game/use-teams-snapshot";

export const usePongHostTeams = () => {
  const host = useAirJamHost<typeof gameInputSchema>();
  return useTeamsSnapshot(host.players, "host");
};
