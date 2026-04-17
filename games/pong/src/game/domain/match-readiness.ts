/**
 * "Can we start the match?" logic.
 *
 * Single source of truth for the host button + the controller start button.
 * A match needs at least one participant on each side; humans and bots both
 * count.
 */
import type { TeamId } from "./team";
import { getEffectiveTeamCounts, type BotCounts, type TeamCounts } from "./team-slots";

export interface MatchReadiness {
  canStart: boolean;
  missingTeam: TeamId | null;
}

export const getMatchReadiness = (
  teamCounts: TeamCounts,
  botCounts: BotCounts,
): MatchReadiness => {
  const effectiveCounts = getEffectiveTeamCounts(teamCounts, botCounts);

  if (effectiveCounts.team1 > 0 && effectiveCounts.team2 > 0) {
    return { canStart: true, missingTeam: null };
  }

  return {
    canStart: false,
    missingTeam: effectiveCounts.team1 === 0 ? "team1" : "team2",
  };
};

export const getLobbyReadinessText = (
  teamCounts: TeamCounts,
  botCounts: BotCounts,
  pointsToWin: number,
  context: "host" | "controller",
): string => {
  const readiness = getMatchReadiness(teamCounts, botCounts);
  if (readiness.canStart) {
    return context === "host"
      ? `Ready. First to ${pointsToWin}. Start on phone.`
      : `Ready. First to ${pointsToWin}.`;
  }

  if (readiness.missingTeam) {
    return context === "host"
      ? "Join a team to start."
      : "Join a team to start.";
  }

  return "Need one player per team.";
};
