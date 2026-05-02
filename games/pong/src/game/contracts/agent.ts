import {
  agentAction,
  agentActionInput,
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "@air-jam/sdk";
import { getMatchReadiness } from "../domain/match-readiness";
import { getTeamLabel, type TeamId } from "../domain/team";
import { getEffectiveTeamCounts, getTeamCounts } from "../domain/team-slots";
import type {
  MatchSummary,
  PongState,
  TeamAssignment,
} from "../stores/pong-store-types";

const DEFAULT_STORE_DOMAIN = "default";
const stores = defineAirJamAgentStores({
  [DEFAULT_STORE_DOMAIN]: agentStore<PongState>(),
});

const TEAM_IDS = ["team1", "team2"] as const satisfies readonly TeamId[];

const summarizeTeam = (
  team: TeamId,
  teamAssignments: Record<string, TeamAssignment>,
  botCount: number,
) => {
  const players = Object.entries(teamAssignments)
    .filter(([, assignment]) => assignment.team === team)
    .sort(([, left], [, right]) =>
      left.position === right.position ? 0 : left.position === "front" ? -1 : 1,
    )
    .map(([playerId, assignment]) => ({
      playerId,
      position: assignment.position,
    }));

  return {
    id: team,
    label: getTeamLabel(team),
    humanCount: players.length,
    botCount,
    totalCount: players.length + botCount,
    players,
  };
};

const summarizeMatch = (matchSummary: MatchSummary | null) => {
  if (!matchSummary) {
    return null;
  }

  return {
    winner: matchSummary.winner,
    winnerLabel: getTeamLabel(matchSummary.winner),
    finalScores: { ...matchSummary.finalScores },
    durationMs: matchSummary.durationMs,
    pointsToWin: matchSummary.pointsToWin,
  };
};

export const agentContract = defineAirJamAgentContract({
  stores,
  snapshotDescription:
    "Game-focused Pong snapshot with team composition, lobby readiness, live score, and ended-match summary for agent-driven joins, starts, and score control.",
  projectSnapshot: (context) => {
    const { controllerId } = context;
    const state = context.stores.default;
    if (!state) {
      return {
        matchPhase: "unavailable",
        summary: "Default replicated Pong store is not available yet.",
      };
    }

    const teamCounts = getTeamCounts(Object.values(state.teamAssignments));
    const readiness = getMatchReadiness(teamCounts, state.botCounts);
    const effectiveTeamCounts = getEffectiveTeamCounts(
      teamCounts,
      state.botCounts,
    );
    const myAssignment =
      controllerId && state.teamAssignments[controllerId]
        ? {
            playerId: controllerId,
            team: state.teamAssignments[controllerId].team,
            teamLabel: getTeamLabel(state.teamAssignments[controllerId].team),
            position: state.teamAssignments[controllerId].position,
          }
        : null;

    return {
      matchPhase: state.matchPhase,
      scores: { ...state.scores },
      pointsToWin: state.pointsToWin,
      canStartMatch: readiness.canStart,
      missingTeam: readiness.missingTeam,
      myAssignment,
      teams: TEAM_IDS.map((team) =>
        summarizeTeam(team, state.teamAssignments, state.botCounts[team]),
      ),
      teamCounts,
      effectiveTeamCounts,
      matchSummary: summarizeMatch(state.matchSummary),
      availableActions: [
        "join_team",
        "set_points_to_win",
        "set_bot_count",
        "start_match",
        "award_point",
        "restart_match",
        "return_to_lobby",
      ],
    };
  },
  actions: {
    join_team: agentAction.participant(
      {
        actionName: "joinTeam",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.enum(TEAM_IDS, {
          payloadDescription: "The team to join.",
        }),
        toPayload: (team) => ({
          team,
        }),
        description:
          "Assign the current controller to a Pong team in the lobby.",
        availability: "Lobby only. Requires a connected controller identity.",
        resultDescription:
          "The controller joins the requested team if a slot is available.",
      },
    ),
    set_points_to_win: agentAction.participant(
      {
        actionName: "setPointsToWin",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.number({
          payloadDescription: "Target score required to win the match.",
        }),
        toPayload: (pointsToWin) => ({
          pointsToWin,
        }),
        description: "Update the Pong win condition from the lobby.",
        availability: "Lobby only.",
        resultDescription: "The lobby updates the match win condition.",
      },
    ),
    set_bot_count: agentAction.participant(
      {
        actionName: "setBotCount",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.custom(
          {
            payloadDescription:
              'A JSON object like {"team":"team1","count":1} selecting the team and desired bot count.',
          },
          (input) => {
            const payload =
              typeof input === "object" && input !== null
                ? (input as Record<string, unknown>)
                : {};
            return {
              team: payload.team === "team2" ? "team2" : "team1",
              count: Number(payload.count ?? 0),
            };
          },
        ),
        description: "Add or remove bots on one Pong team from the lobby.",
        availability: "Lobby only.",
        resultDescription:
          "The requested team bot count updates, subject to team slot limits.",
      },
    ),
    start_match: agentAction.participant(
      {
        actionName: "startMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.none(),
        description:
          "Start the Pong match once each team has at least one participant.",
        availability: "Lobby only.",
        resultDescription: "The match phase switches from lobby to playing.",
      },
    ),
    award_point: agentAction.participant(
      {
        actionName: "scorePoint",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.enum(TEAM_IDS, {
          payloadDescription: "The team that should receive the point.",
        }),
        toPayload: (team) => ({
          team,
        }),
        description:
          "Award one point to a Pong team. Useful for agent QA and deterministic match-end checks.",
        availability: "Playing only.",
        resultDescription:
          "The score increments, and the match can end if the win threshold is reached.",
      },
    ),
    restart_match: agentAction.participant(
      {
        actionName: "restartMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.none(),
        description: "Restart Pong immediately from the ended screen.",
        availability: "Ended matches only.",
        resultDescription:
          "The score resets and the match returns to the playing phase.",
      },
    ),
    return_to_lobby: agentAction.participant(
      {
        actionName: "returnToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.none(),
        description:
          "Return the Pong match to the lobby without restarting dev.",
        availability: "Any phase.",
        resultDescription:
          "The match returns to the lobby with scores cleared and the current roster preserved.",
      },
    ),
  },
});
