import {
  agentAction,
  agentActionInput,
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "@air-jam/sdk";
import { getMatchReadiness, getTeamCounts } from "../domain/match-readiness";
import { TEAM_CONFIG, TEAM_IDS, type TeamId } from "../domain/team";
import type {
  MatchStateSnapshot,
  MatchSummary,
  TeamAssignment,
} from "../stores/match/match-store-types";

const DEFAULT_STORE_DOMAIN = "default";

const stores = defineAirJamAgentStores({
  [DEFAULT_STORE_DOMAIN]: agentStore<MatchStateSnapshot>(),
});

const summarizeTeam = (
  teamId: TeamId,
  teamAssignments: Record<string, TeamAssignment>,
  botCounts: MatchStateSnapshot["botCounts"],
) => {
  const players = Object.entries(teamAssignments)
    .filter(([, assignment]) => assignment.teamId === teamId)
    .map(([playerId]) => ({
      playerId,
    }));

  return {
    id: teamId,
    label: TEAM_CONFIG[teamId].label,
    humanCount: players.length,
    botCount: botCounts[teamId],
    totalCount: players.length + botCounts[teamId],
    players,
  };
};

const summarizeMatch = (matchSummary: MatchSummary | null) => {
  if (!matchSummary) {
    return null;
  }

  return {
    winner: matchSummary.winner,
    winnerLabel: TEAM_CONFIG[matchSummary.winner].label,
    finalScores: { ...matchSummary.finalScores },
    pointsToWin: matchSummary.pointsToWin,
    durationMs: matchSummary.durationMs,
  };
};

export const agentContract = defineAirJamAgentContract({
  stores,
  snapshotDescription:
    "Game-focused Air Capture snapshot with lobby team composition, bot counts, points-to-win target, live phase, and ended-match summary.",
  projectSnapshot: (context) => {
    const { controllerId } = context;
    const state = context.stores.default;
    if (!state) {
      return {
        matchPhase: "unavailable",
        summary:
          "Default replicated Air Capture match store is not available yet.",
      };
    }

    const humanCounts = getTeamCounts(Object.values(state.teamAssignments));
    const readiness = getMatchReadiness(humanCounts, state.botCounts);
    const myAssignment =
      controllerId && state.teamAssignments[controllerId]
        ? {
            playerId: controllerId,
            teamId: state.teamAssignments[controllerId].teamId,
            teamLabel:
              TEAM_CONFIG[state.teamAssignments[controllerId].teamId].label,
          }
        : null;

    return {
      matchPhase: state.matchPhase,
      pointsToWin: state.pointsToWin,
      canStartMatch: readiness.canStart,
      myAssignment,
      teams: TEAM_IDS.map((teamId) =>
        summarizeTeam(teamId, state.teamAssignments, state.botCounts),
      ),
      humanCounts,
      botCounts: { ...state.botCounts },
      matchSummary: summarizeMatch(state.matchSummary),
      availableActions: [
        "join_team",
        "set_team_bot_count",
        "set_points_to_win",
        "start_match",
        "restart_match",
        "return_to_lobby",
        "force_end_match",
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
        toPayload: (teamId) => ({ teamId }),
        description:
          "Assign the current controller to the Solaris or Nebulon team in the lobby.",
        availability: "Lobby only. Requires a connected controller identity.",
        resultDescription:
          "The controller joins the requested team if a slot is available.",
      },
    ),
    set_team_bot_count: agentAction.participant(
      {
        actionName: "setTeamBotCount",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.custom(
          {
            payloadDescription:
              'A JSON object like {"teamId":"solaris","count":1} selecting the team and desired bot count.',
          },
          (input) => {
            const payload =
              typeof input === "object" && input !== null
                ? (input as Record<string, unknown>)
                : {};

            return {
              teamId: payload.teamId === "nebulon" ? "nebulon" : "solaris",
              count: Number(payload.count ?? 0),
            };
          },
        ),
        description: "Add or remove bots on one Air Capture team.",
        availability: "Lobby only, or host-side playing-state orchestration.",
        resultDescription:
          "The requested team bot count updates, subject to slot limits.",
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
        description: "Update the Air Capture win condition from the lobby.",
        availability: "Lobby only.",
        resultDescription: "The lobby updates the match win condition.",
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
          "Start the Air Capture match once both teams are represented.",
        availability: "Lobby only.",
        resultDescription:
          "The match leaves the lobby and enters its countdown phase.",
      },
    ),
    restart_match: agentAction.participant(
      {
        actionName: "restartMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.none(),
        description: "Restart Air Capture immediately from the ended screen.",
        availability: "Ended matches only.",
        resultDescription:
          "The match resets and returns to its countdown-to-playing flow.",
      },
    ),
    return_to_lobby: agentAction.participant(
      {
        actionName: "returnToLobby",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.none(),
        description: "Return the Air Capture match to the lobby.",
        availability: "Playing or ended phases.",
        resultDescription:
          "The match returns to the lobby with score state cleared.",
      },
    ),
    force_end_match: agentAction.participant(
      {
        actionName: "endMatch",
        storeDomain: DEFAULT_STORE_DOMAIN,
      },
      {
        input: agentActionInput.custom(
          {
            payloadDescription:
              'A JSON object like {"winner":"solaris","finalScores":{"solaris":1,"nebulon":0}}.',
          },
          (input) => {
            const payload =
              typeof input === "object" && input !== null
                ? (input as Record<string, unknown>)
                : {};
            const finalScores =
              payload.finalScores &&
              typeof payload.finalScores === "object" &&
              payload.finalScores !== null
                ? (payload.finalScores as Record<string, unknown>)
                : {};

            return {
              winner: payload.winner === "nebulon" ? "nebulon" : "solaris",
              finalScores: {
                solaris: Number(finalScores.solaris ?? 0),
                nebulon: Number(finalScores.nebulon ?? 0),
              } as Record<TeamId, number>,
            };
          },
        ),
        description:
          "Finish the current Air Capture match with an explicit winner and final scoreline.",
        availability:
          "Playing only. Useful for deterministic QA and visual proof.",
        resultDescription:
          "The match ends and publishes the requested winner and scores.",
      },
    ),
  },
});
