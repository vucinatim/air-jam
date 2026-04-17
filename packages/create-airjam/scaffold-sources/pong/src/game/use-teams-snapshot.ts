import type { PlayerProfile } from "@air-jam/sdk";
import { useMemo } from "react";
import {
  getLobbyReadinessText,
  getMatchReadiness,
  type MatchReadiness,
} from "./domain/match-readiness";
import type { PaddleSlotPosition } from "./domain/team-slots";
import {
  getTeamCounts,
  type BotCounts,
  type TeamCounts,
} from "./domain/team-slots";
import { usePongStore, type PongState, type TeamAssignment } from "./stores";

/**
 * Shared, memoised view over the networked pong store's team layout.
 *
 * Both the host and controller surfaces need the same derived data every
 * render: the team1/team2 player lists, the effective team counts (humans +
 * bots), and the match-readiness flag. Computing those live in the surface
 * components means duplicating ~40 lines of memo chains in two places; this
 * hook centralises the computation and only depends on store state that is
 * already synchronised across host and controller.
 *
 * @param players - the connected player roster from the host or controller
 *                  session. Missing players are automatically dropped from
 *                  the returned team lists.
 * @param perspective - "host" or "controller"; only changes the readiness
 *                      copy that the surface displays.
 */
export interface TeamsSnapshot {
  teamAssignments: Record<string, TeamAssignment>;
  botCounts: BotCounts;
  pointsToWin: number;
  matchPhase: PongState["matchPhase"];
  matchSummary: PongState["matchSummary"];
  team1Players: PlayerProfile[];
  team2Players: PlayerProfile[];
  teamCounts: TeamCounts;
  readiness: MatchReadiness;
  readinessText: string;
}

const positionRank = (position: PaddleSlotPosition | undefined): number =>
  position === "front" ? 0 : 1;

const sortByAssignmentPosition = (
  players: PlayerProfile[],
  teamAssignments: Record<string, TeamAssignment>,
): PlayerProfile[] =>
  [...players].sort(
    (left, right) =>
      positionRank(teamAssignments[left.id]?.position) -
      positionRank(teamAssignments[right.id]?.position),
  );

export const useTeamsSnapshot = (
  players: PlayerProfile[],
  perspective: "host" | "controller",
): TeamsSnapshot => {
  const teamAssignments = usePongStore(
    (state: PongState) => state.teamAssignments,
  );
  const botCounts = usePongStore((state: PongState) => state.botCounts);
  const pointsToWin = usePongStore((state: PongState) => state.pointsToWin);
  const matchPhase = usePongStore((state: PongState) => state.matchPhase);
  const matchSummary = usePongStore((state: PongState) => state.matchSummary);

  const team1Players = useMemo(
    () =>
      sortByAssignmentPosition(
        players.filter(
          (player) => teamAssignments[player.id]?.team === "team1",
        ),
        teamAssignments,
      ),
    [players, teamAssignments],
  );

  const team2Players = useMemo(
    () =>
      sortByAssignmentPosition(
        players.filter(
          (player) => teamAssignments[player.id]?.team === "team2",
        ),
        teamAssignments,
      ),
    [players, teamAssignments],
  );

  const teamCounts = useMemo(
    () =>
      getTeamCounts([
        ...team1Players.map(() => ({ team: "team1" as const })),
        ...team2Players.map(() => ({ team: "team2" as const })),
      ]),
    [team1Players, team2Players],
  );

  const readiness = useMemo(
    () => getMatchReadiness(teamCounts, botCounts),
    [botCounts, teamCounts],
  );

  const readinessText = useMemo(
    () => getLobbyReadinessText(teamCounts, botCounts, pointsToWin, perspective),
    [botCounts, perspective, pointsToWin, teamCounts],
  );

  return {
    teamAssignments,
    botCounts,
    pointsToWin,
    matchPhase,
    matchSummary,
    team1Players,
    team2Players,
    teamCounts,
    readiness,
    readinessText,
  };
};
