import { defineAirJamGameAgentContract } from "@air-jam/sdk";
import { getMatchReadiness } from "../domain/match-readiness";
import { type Team, type TeamAssignment } from "../domain/team-assignments";
import type {
  BotCounts,
  CodeReviewGameState,
  CodeReviewMatchSummary,
} from "../stores/code-review-store-types";

const DEFAULT_STORE_DOMAIN = "default";
const TEAM_IDS = ["team1", "team2"] as const satisfies readonly Team[];
const TEAM_LABEL: Record<Team, string> = {
  team1: "Coder",
  team2: "Reviewer",
};

const readCodeReviewState = (
  stores: Record<string, Record<string, unknown>>,
): CodeReviewGameState | null => {
  const candidate = stores[DEFAULT_STORE_DOMAIN];
  if (!candidate) {
    return null;
  }

  return candidate as unknown as CodeReviewGameState;
};

const summarizeTeam = (
  team: Team,
  teamAssignments: Record<string, TeamAssignment>,
  botCounts: BotCounts,
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
    label: TEAM_LABEL[team],
    humanCount: players.length,
    botCount: botCounts[team],
    totalCount: players.length + botCounts[team],
    players,
  };
};

const summarizeMatch = (matchSummary: CodeReviewMatchSummary | null) => {
  if (!matchSummary) {
    return null;
  }

  return {
    winner: matchSummary.winner,
    winnerLabel:
      matchSummary.winner === "draw" ? "Draw" : TEAM_LABEL[matchSummary.winner],
    scores: { ...matchSummary.scores },
  };
};

export const gameAgentContract = defineAirJamGameAgentContract({
  gameId: "code-review",
  snapshotStoreDomains: [DEFAULT_STORE_DOMAIN],
  snapshotDescription:
    "Game-focused Code Review snapshot with lobby team composition, bot counts, readiness, live score, and ended-match summary.",
  projectSnapshot: ({ controllerId, stores }) => {
    const state = readCodeReviewState(stores);
    if (!state) {
      return {
        matchPhase: "unavailable",
        summary: "Default replicated Code Review store is not available yet.",
      };
    }

    const teamCounts = {
      team1: Object.values(state.teamAssignments).filter(
        (assignment) => assignment.team === "team1",
      ).length,
      team2: Object.values(state.teamAssignments).filter(
        (assignment) => assignment.team === "team2",
      ).length,
    };
    const readiness = getMatchReadiness(teamCounts, state.botCounts);
    const myAssignment =
      controllerId && state.teamAssignments[controllerId]
        ? {
            playerId: controllerId,
            team: state.teamAssignments[controllerId].team,
            teamLabel: TEAM_LABEL[state.teamAssignments[controllerId].team],
            position: state.teamAssignments[controllerId].position,
          }
        : null;

    return {
      matchPhase: state.matchPhase,
      scores: { ...state.scores },
      canStartMatch: readiness.canStart,
      myAssignment,
      teams: TEAM_IDS.map((team) =>
        summarizeTeam(team, state.teamAssignments, state.botCounts),
      ),
      matchSummary: summarizeMatch(state.matchSummary),
      availableActions: [
        "join_team",
        "set_bot_count",
        "start_match",
        "award_point",
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
      description:
        "Assign the current controller to the Coder or Reviewer team in the lobby.",
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
    set_bot_count: {
      target: {
        kind: "controller",
        actionName: "setBotCount",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Add or remove bots on one Code Review team from the lobby.",
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
        "Start the Code Review match once both sides have at least one participant.",
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
        "Award one point to a Code Review team for deterministic QA and ended-state checks.",
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
        "The score increments for the requested team and can drive the match into its ended state.",
    },
    return_to_lobby: {
      target: {
        kind: "controller",
        actionName: "resetToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      description: "Return the Code Review match to the lobby.",
      availability: "Playing or ended phases.",
      payload: {
        kind: "none",
      },
      resultDescription:
        "The game returns to the lobby and clears the live score state.",
    },
  },
});
