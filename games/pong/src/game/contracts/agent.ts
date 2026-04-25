import { defineAirJamGameAgentContract } from "@air-jam/sdk";
import { getMatchReadiness } from "../domain/match-readiness";
import { getTeamLabel, type TeamId } from "../domain/team";
import { getEffectiveTeamCounts, getTeamCounts } from "../domain/team-slots";
import type {
  MatchSummary,
  PongState,
  TeamAssignment,
} from "../stores/pong-store-types";

const DEFAULT_STORE_DOMAIN = "default";

const TEAM_IDS = ["team1", "team2"] as const satisfies readonly TeamId[];

const readPongState = (
  stores: Record<string, Record<string, unknown>>,
): PongState | null => {
  const candidate = stores[DEFAULT_STORE_DOMAIN];
  if (!candidate) {
    return null;
  }

  return candidate as unknown as PongState;
};

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

export const gameAgentContract = defineAirJamGameAgentContract({
  gameId: "pong",
  snapshotStoreDomains: [DEFAULT_STORE_DOMAIN],
  snapshotDescription:
    "Game-focused Pong snapshot with team composition, lobby readiness, live score, and ended-match summary for agent-driven joins, starts, and score control.",
  projectSnapshot: ({ controllerId, stores }) => {
    const state = readPongState(stores);
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
    join_team: {
      target: {
        kind: "controller",
        actionName: "joinTeam",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Assign the current controller to a Pong team in the lobby.",
      availability: "Lobby only. Requires a connected controller identity.",
      payload: {
        kind: "enum",
        description: "The team to join.",
        allowedValues: [...TEAM_IDS],
      },
      resolveInput: (input) => ({
        team: input,
      }),
      resultDescription:
        "The controller joins the requested team if a slot is available.",
    },
    set_points_to_win: {
      target: {
        kind: "controller",
        actionName: "setPointsToWin",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Update the Pong win condition from the lobby.",
      availability: "Lobby only.",
      payload: {
        kind: "number",
        description: "Target score required to win the match.",
      },
      resolveInput: (input) => ({
        pointsToWin: Number(input),
      }),
      resultDescription: "The lobby updates the match win condition.",
    },
    set_bot_count: {
      target: {
        kind: "controller",
        actionName: "setBotCount",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Add or remove bots on one Pong team from the lobby.",
      availability: "Lobby only.",
      payload: {
        kind: "json",
        description:
          'A JSON object like {"team":"team1","count":1} selecting the team and desired bot count.',
      },
      resolveInput: (input) => {
        const payload =
          typeof input === "object" && input !== null
            ? (input as Record<string, unknown>)
            : {};
        return {
          team: payload.team === "team2" ? "team2" : "team1",
          count: Number(payload.count ?? 0),
        };
      },
      resultDescription:
        "The requested team bot count updates, subject to team slot limits.",
    },
    start_match: {
      target: {
        kind: "controller",
        actionName: "startMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Start the Pong match once each team has at least one participant.",
      availability: "Lobby only.",
      payload: {
        kind: "none",
      },
      resultDescription: "The match phase switches from lobby to playing.",
    },
    award_point: {
      target: {
        kind: "controller",
        actionName: "scorePoint",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description:
        "Award one point to a Pong team. Useful for agent QA and deterministic match-end checks.",
      availability: "Playing only.",
      payload: {
        kind: "enum",
        description: "The team that should receive the point.",
        allowedValues: [...TEAM_IDS],
      },
      resolveInput: (input) => ({
        team: input,
      }),
      resultDescription:
        "The score increments, and the match can end if the win threshold is reached.",
    },
    restart_match: {
      target: {
        kind: "controller",
        actionName: "restartMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Restart Pong immediately from the ended screen.",
      availability: "Ended matches only.",
      payload: {
        kind: "none",
      },
      resultDescription:
        "The score resets and the match returns to the playing phase.",
    },
    return_to_lobby: {
      target: {
        kind: "controller",
        actionName: "returnToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Return the Pong match to the lobby without restarting dev.",
      availability: "Any phase.",
      payload: {
        kind: "none",
      },
      resultDescription:
        "The match returns to the lobby with scores cleared and the current roster preserved.",
    },
  },
});
