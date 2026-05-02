import { MATCH_POINTS_TO_WIN } from "./match-rules";

export type TeamCounts = { team1: number; team2: number };

export const getEffectiveTeamCounts = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
): TeamCounts => ({
  team1: humanCounts.team1 + botCounts.team1,
  team2: humanCounts.team2 + botCounts.team2,
});

export const getMatchReadiness = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
): { canStart: boolean } => {
  const effective = getEffectiveTeamCounts(humanCounts, botCounts);
  const humanTotal = humanCounts.team1 + humanCounts.team2;
  const hasBothTeams = effective.team1 > 0 && effective.team2 > 0;

  return {
    canStart: hasBothTeams && humanTotal > 0,
  };
};

export const getLobbyReadinessText = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
): string => {
  const readiness = getMatchReadiness(humanCounts, botCounts);
  if (readiness.canStart) {
    return `Ready. First to ${MATCH_POINTS_TO_WIN}.`;
  }

  const totalHumans = humanCounts.team1 + humanCounts.team2;
  const totalBots = botCounts.team1 + botCounts.team2;

  if (totalHumans === 0 && totalBots === 0) {
    return "Join a team to start.";
  }

  if (totalHumans === 0 && totalBots > 0) {
    return "At least one human player is required to start.";
  }

  const emptyTeams: string[] = [];
  if (humanCounts.team1 + botCounts.team1 === 0) {
    emptyTeams.push("Coder");
  }
  if (humanCounts.team2 + botCounts.team2 === 0) {
    emptyTeams.push("Reviewer");
  }

  if (emptyTeams.length > 0) {
    return `Add players or bots to ${emptyTeams.join(" and ")}.`;
  }

  return "Teams are incomplete.";
};
