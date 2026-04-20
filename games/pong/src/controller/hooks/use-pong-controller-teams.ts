import { useAirJamController } from "@air-jam/sdk";
import { useMemo } from "react";
import type { TeamId } from "../../game/domain/team";
import { useTeamsSnapshot } from "../../game/domain/teams-snapshot";

export const usePongControllerTeams = () => {
  const controller = useAirJamController();
  const teams = useTeamsSnapshot(controller.players, "controller");

  const myTeam = useMemo<TeamId | null>(() => {
    if (!controller.controllerId) {
      return null;
    }

    return teams.teamAssignments[controller.controllerId]?.team ?? null;
  }, [controller.controllerId, teams.teamAssignments]);

  return {
    ...teams,
    myTeam,
  };
};
