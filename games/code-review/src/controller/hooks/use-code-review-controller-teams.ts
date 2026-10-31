import { useAirJamController, useAirJamStore } from "@air-jam/sdk";
import { useMemo } from "react";
import {
  getLobbyReadinessText,
  getMatchReadiness,
} from "../../game/domain/match-readiness";
import { gameStore } from "../../game/stores";
import { codeReviewTheme } from "../../game/theme";

const TEAM1_COLOR = codeReviewTheme.colors.ringRopePrimary;
const TEAM2_COLOR = codeReviewTheme.colors.ringCornerBlue;

export const useCodeReviewControllerTeams = () => {
  const controllerId = useAirJamController((state) => state.controllerId);
  const players = useAirJamController((state) => state.players);
  const teamAssignments = useAirJamStore(
    gameStore,
    (state) => state.teamAssignments,
  );
  const pointsToWin = useAirJamStore(gameStore, (state) => state.pointsToWin);
  const botCounts = useAirJamStore(gameStore, (state) => state.botCounts);

  const myAssignment = controllerId ? teamAssignments[controllerId] : null;
  const myProfile = controllerId
    ? (players.find((player) => player.id === controllerId) ?? null)
    : null;
  const myTeam = myAssignment?.team ?? null;
  const teamColor =
    myTeam === "team1" ? TEAM1_COLOR : myTeam === "team2" ? TEAM2_COLOR : null;
  const teamAccent = teamColor ?? codeReviewTheme.colors.teamAccent;

  const connectedPlayerIdSet = useMemo(
    () => new Set(players.map((player) => player.id)),
    [players],
  );
  const connectedTeamAssignments = useMemo(
    () =>
      Object.entries(teamAssignments)
        .filter(([playerId]) => connectedPlayerIdSet.has(playerId))
        .map(([, assignment]) => assignment),
    [connectedPlayerIdSet, teamAssignments],
  );
  const teamHumanCounts = useMemo(
    () => ({
      team1: connectedTeamAssignments.filter((entry) => entry.team === "team1")
        .length,
      team2: connectedTeamAssignments.filter((entry) => entry.team === "team2")
        .length,
    }),
    [connectedTeamAssignments],
  );
  const team1Players = useMemo(
    () =>
      players
        .filter((player) => teamAssignments[player.id]?.team === "team1")
        .sort((left, right) => {
          const leftPosition =
            teamAssignments[left.id]?.position === "front" ? 0 : 1;
          const rightPosition =
            teamAssignments[right.id]?.position === "front" ? 0 : 1;
          return leftPosition - rightPosition;
        }),
    [players, teamAssignments],
  );
  const team2Players = useMemo(
    () =>
      players
        .filter((player) => teamAssignments[player.id]?.team === "team2")
        .sort((left, right) => {
          const leftPosition =
            teamAssignments[left.id]?.position === "front" ? 0 : 1;
          const rightPosition =
            teamAssignments[right.id]?.position === "front" ? 0 : 1;
          return leftPosition - rightPosition;
        }),
    [players, teamAssignments],
  );
  const readiness = useMemo(
    () => getMatchReadiness(teamHumanCounts, botCounts),
    [botCounts, teamHumanCounts],
  );
  const readinessText = useMemo(
    () => getLobbyReadinessText(pointsToWin, teamHumanCounts, botCounts),
    [botCounts, teamHumanCounts, pointsToWin],
  );

  return {
    pointsToWin,
    botCounts,
    myProfile,
    myTeam,
    readiness,
    readinessText,
    teamAccent,
    teamHumanCounts,
    team1Players,
    team2Players,
  };
};
