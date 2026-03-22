import type { TeamId } from "./team";
import { getTeamLabel } from "./team";

export interface TeamCounts {
  team1: number;
  team2: number;
}

export type BotTeam = TeamId | null;

export interface MatchReadiness {
  canStart: boolean;
  missingTeam: TeamId | null;
}

export const getTeamCounts = (
  assignments: Iterable<{ team: TeamId }>,
): TeamCounts => {
  let team1 = 0;
  let team2 = 0;

  for (const assignment of assignments) {
    if (assignment.team === "team1") {
      team1 += 1;
    } else {
      team2 += 1;
    }
  }

  return { team1, team2 };
};

export const getMatchReadiness = (
  teamCounts: TeamCounts,
  botTeam: BotTeam,
): MatchReadiness => {
  if (botTeam === "team1") {
    return {
      canStart: teamCounts.team2 > 0,
      missingTeam: teamCounts.team2 > 0 ? null : "team2",
    };
  }

  if (botTeam === "team2") {
    return {
      canStart: teamCounts.team1 > 0,
      missingTeam: teamCounts.team1 > 0 ? null : "team1",
    };
  }

  if (teamCounts.team1 > 0 && teamCounts.team2 > 0) {
    return { canStart: true, missingTeam: null };
  }

  return {
    canStart: false,
    missingTeam: teamCounts.team1 === 0 ? "team1" : "team2",
  };
};

export const getLobbyReadinessText = (
  teamCounts: TeamCounts,
  botTeam: BotTeam,
  pointsToWin: number,
  context: "host" | "controller",
): string => {
  const readiness = getMatchReadiness(teamCounts, botTeam);
  if (readiness.canStart) {
    return context === "host"
      ? `Ready. First to ${pointsToWin}. Start on phone.`
      : `Ready. First to ${pointsToWin}.`;
  }

  if (readiness.missingTeam) {
    return `Join ${getTeamLabel(readiness.missingTeam)} to start.`;
  }

  return "Need one player per team.";
};
