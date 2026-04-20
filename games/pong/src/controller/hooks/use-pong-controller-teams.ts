import { useAirJamController } from "@air-jam/sdk";
import { useMemo } from "react";
import type { TeamId } from "../../game/domain/team";
import { useTeamsSnapshot } from "../../game/domain/teams-snapshot";

export const usePongControllerTeams = () => {
  const controllerId = useAirJamController((state) => state.controllerId);
  const players = useAirJamController((state) => state.players);
  const teams = useTeamsSnapshot(players, "controller");

  const myTeam = useMemo<TeamId | null>(() => {
    if (!controllerId) {
      return null;
    }

    return teams.teamAssignments[controllerId]?.team ?? null;
  }, [controllerId, teams.teamAssignments]);

  return {
    ...teams,
    myTeam,
  };
};
