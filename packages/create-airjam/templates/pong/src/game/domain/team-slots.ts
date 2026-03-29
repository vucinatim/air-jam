import type { TeamId } from "./team";
import type { TeamAssignment } from "../stores";

export type PaddleSlotPosition = "front" | "back";

export interface TeamCounts {
  team1: number;
  team2: number;
}

export interface BotCounts {
  team1: number;
  team2: number;
}

export const MAX_TEAM_SLOTS = 2;
export const TEAM_SLOT_POSITIONS: PaddleSlotPosition[] = ["front", "back"];

export const createEmptyBotCounts = (): BotCounts => ({
  team1: 0,
  team2: 0,
});

export const clampBotCount = (value: number): number =>
  Math.max(0, Math.min(MAX_TEAM_SLOTS, Math.round(value)));

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

export const getEffectiveTeamCounts = (
  humanCounts: TeamCounts,
  botCounts: BotCounts,
): TeamCounts => ({
  team1: humanCounts.team1 + botCounts.team1,
  team2: humanCounts.team2 + botCounts.team2,
});

const compareAssignments = (left: TeamAssignment, right: TeamAssignment): number => {
  if (left.position === right.position) {
    return 0;
  }

  return left.position === "front" ? -1 : 1;
};

export const normalizeTeamAssignments = (
  assignments: Record<string, TeamAssignment>,
): Record<string, TeamAssignment> => {
  const nextAssignments: Record<string, TeamAssignment> = {};
  let changed = false;

  (["team1", "team2"] as const).forEach((team) => {
    const teamPlayers = Object.entries(assignments)
      .filter(([, assignment]) => assignment.team === team)
      .sort(([, left], [, right]) => compareAssignments(left, right));

    teamPlayers.forEach(([playerId, assignment], index) => {
      const normalizedPosition = TEAM_SLOT_POSITIONS[index];
      if (!normalizedPosition) {
        changed = true;
        return;
      }

      if (assignment.position !== normalizedPosition) {
        changed = true;
      }

      nextAssignments[playerId] = {
        team,
        position: normalizedPosition,
      };
    });
  });

  if (!changed && Object.keys(nextAssignments).length === Object.keys(assignments).length) {
    return assignments;
  }

  return nextAssignments;
};

export const getTeamHumanCount = (
  assignments: Record<string, TeamAssignment>,
  team: TeamId,
): number =>
  Object.values(assignments).filter((assignment) => assignment.team === team).length;

export const getAvailableTeamSlots = (
  assignments: Record<string, TeamAssignment>,
  team: TeamId,
): PaddleSlotPosition[] => {
  const occupied = new Set(
    Object.values(assignments)
      .filter((assignment) => assignment.team === team)
      .map((assignment) => assignment.position),
  );

  return TEAM_SLOT_POSITIONS.filter((position) => !occupied.has(position));
};

export const getBotPositions = (
  assignments: Record<string, TeamAssignment>,
  botCounts: BotCounts,
  team: TeamId,
): PaddleSlotPosition[] =>
  getAvailableTeamSlots(assignments, team).slice(0, clampBotCount(botCounts[team]));
