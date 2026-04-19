export type Team = "team1" | "team2";
export type Position = "front" | "back";

export interface TeamAssignment {
  team: Team;
  position: Position;
}

const MAX_PLAYERS_PER_TEAM = 2;
const TEAM_ORDER: Team[] = ["team1", "team2"];
const POSITION_ORDER: Position[] = ["front", "back"];

const withActorConnected = (
  connectedPlayerIds: string[],
  actorId?: string,
): Set<string> => {
  const connectedSet = new Set(connectedPlayerIds);
  if (actorId) {
    connectedSet.add(actorId);
  }
  return connectedSet;
};

export const pruneDisconnectedAssignments = (
  assignments: Record<string, TeamAssignment>,
  connectedPlayerIds: string[],
  actorId?: string,
): Record<string, TeamAssignment> => {
  const connectedSet = withActorConnected(connectedPlayerIds, actorId);
  const nextAssignments = Object.fromEntries(
    Object.entries(assignments).filter(([playerId]) =>
      connectedSet.has(playerId),
    ),
  );

  return normalizeAssignments(nextAssignments);
};

export const normalizeAssignments = (
  assignments: Record<string, TeamAssignment>,
): Record<string, TeamAssignment> => {
  const nextAssignments: Record<string, TeamAssignment> = {};

  TEAM_ORDER.forEach((team) => {
    const players = Object.entries(assignments)
      .filter(([, assignment]) => assignment.team === team)
      .sort(([leftId, leftAssignment], [rightId, rightAssignment]) => {
        const leftIndex = POSITION_ORDER.indexOf(leftAssignment.position);
        const rightIndex = POSITION_ORDER.indexOf(rightAssignment.position);
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }
        return leftId.localeCompare(rightId);
      })
      .slice(0, MAX_PLAYERS_PER_TEAM);

    players.forEach(([playerId], index) => {
      nextAssignments[playerId] = {
        team,
        position: POSITION_ORDER[index] ?? "back",
      };
    });
  });

  return nextAssignments;
};

export const assignmentsEqual = (
  left: Record<string, TeamAssignment>,
  right: Record<string, TeamAssignment>,
): boolean => {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([playerId, assignment]) => {
    const other = right[playerId];
    return (
      other?.team === assignment.team && other.position === assignment.position
    );
  });
};

export const canJoinTeam = (
  assignments: Record<string, TeamAssignment>,
  team: Team,
): boolean =>
  Object.values(assignments).filter((assignment) => assignment.team === team)
    .length < MAX_PLAYERS_PER_TEAM;
