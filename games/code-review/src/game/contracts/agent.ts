import {
  agentAction,
  agentActionInput,
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "@air-jam/sdk";
import { getMatchReadiness } from "../domain/match-readiness";
import { type Team, type TeamAssignment } from "../domain/team-assignments";
import type {
  BotCounts,
  CodeReviewGameState,
  CodeReviewMatchSummary,
} from "../stores/code-review-store-types";

const DEFAULT_STORE_DOMAIN = "default";
const stores = defineAirJamAgentStores({
  [DEFAULT_STORE_DOMAIN]: agentStore<CodeReviewGameState>(),
});
const TEAM_IDS = ["team1", "team2"] as const satisfies readonly Team[];
const TEAM_LABEL: Record<Team, string> = {
  team1: "Coder",
  team2: "Reviewer",
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

export const agentContract = defineAirJamAgentContract({
  stores,
  snapshotDescription:
    "Game-focused Code Review snapshot with lobby team composition, bot counts, readiness, live score, and ended-match summary.",
  projectSnapshot: (context) => {
    const { controllerId } = context;
    const state = context.stores.default;
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
    join_team: agentAction.participant(
      {
        actionName: "joinTeam",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.enum(TEAM_IDS, {
          payloadDescription: "The team to join.",
        }),
        toPayload: (team) => ({ team }),
        description:
          "Assign the current controller to the Coder or Reviewer team in the lobby.",
        availability: "Lobby only. Requires a connected controller identity.",
        resultDescription:
          "The controller joins the requested team if a slot is available.",
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
            payloadKind: "json",
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
        description:
          "Add or remove bots on one Code Review team from the lobby.",
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
          "Start the Code Review match once both sides have at least one participant.",
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
        toPayload: (team) => ({ team }),
        description:
          "Award one point to a Code Review team for deterministic QA and ended-state checks.",
        availability: "Playing only.",
        resultDescription:
          "The score increments for the requested team and can drive the match into its ended state.",
      },
    ),
    return_to_lobby: agentAction.participant(
      {
        actionName: "resetToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.none(),
        description: "Return the Code Review match to the lobby.",
        availability: "Playing or ended phases.",
        resultDescription:
          "The game returns to the lobby and clears the live score state.",
      },
    ),
  },
});
