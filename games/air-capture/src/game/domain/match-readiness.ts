import type { TeamAssignment } from "../stores/match/match-store-types";
import { TEAM_CONFIG, TEAM_IDS, type TeamId } from "./team";
import { getEffectiveTeamCounts } from "./team-slots";

export type TeamCounts = Record<TeamId, number>;

export const createEmptyTeamCounts = (): TeamCounts =>
  TEAM_IDS.reduce((acc, teamId) => {
    acc[teamId] = 0;
    return acc;
  }, {} as TeamCounts);

export const getTeamCounts = (assignments: TeamAssignment[]): TeamCounts => {
  return assignments.reduce((acc, assignment) => {
    acc[assignment.teamId] += 1;
    return acc;
  }, createEmptyTeamCounts());
};

export const getMatchReadiness = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
): { canStart: boolean } => {
  const effectiveCounts = getEffectiveTeamCounts(humanCounts, botCounts);
  const hasBothTeams = TEAM_IDS.every((teamId) => effectiveCounts[teamId] > 0);
  const humanCount = TEAM_IDS.reduce((total, teamId) => {
    return total + humanCounts[teamId];
  }, 0);

  return {
    canStart: hasBothTeams && humanCount > 0,
  };
};

export const getLobbyReadinessText = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
  pointsToWin: number,
): string => {
  const readiness = getMatchReadiness(humanCounts, botCounts);
  if (readiness.canStart) {
    return `Ready. First to ${pointsToWin}.`;
  }

  const totalHumans = Object.values(humanCounts).reduce(
    (total, count) => total + count,
    0,
  );
  const totalBots = Object.values(botCounts).reduce(
    (total, count) => total + count,
    0,
  );

  if (totalHumans === 0 && totalBots === 0) {
    return "Need at least one player on each team.";
  }

  if (totalHumans === 0 && totalBots > 0) {
    return "At least one human player is required to start.";
  }

  const emptyTeams = TEAM_IDS.filter(
    (teamId) => humanCounts[teamId] + botCounts[teamId] === 0,
  );

  if (emptyTeams.length > 0) {
    return `Add players or bots to ${emptyTeams
      .map((teamId) => TEAM_CONFIG[teamId].label)
      .join(" and ")}.`;
  }

  return "Teams are incomplete.";
};
