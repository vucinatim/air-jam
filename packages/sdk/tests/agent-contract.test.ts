import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineAirJamAgentContract,
  defineAirJamAgentStores,
  agentAction,
  agentStore,
  agentActionInput,
} from "../src";
import {
  describeAirJamAgentAction,
  listAirJamAgentStoreDomains,
  resolveAirJamAgentActionPayload,
} from "../src/agent-tooling";

describe("agentAction", () => {
  it("projects snapshots from declared named stores without generic casts", () => {
    const stores = defineAirJamAgentStores({
      default: agentStore<{ phase: string }>(),
      scoreboard: agentStore<{ home: number; away: number }>(),
    });
    const contract = defineAirJamAgentContract({
      stores,
      projectSnapshot: (context) => {
        const game = context.stores.default;
        const scoreboard = context.stores.scoreboard;
        return {
          phase: game?.phase ?? "unknown",
          home: scoreboard?.home ?? 0,
          away: scoreboard?.away ?? 0,
        };
      },
      actions: {},
    });

    expect(listAirJamAgentStoreDomains(contract)).toEqual([
      "default",
      "scoreboard",
    ]);
    expect(
      contract.projectSnapshot({
        controllerId: "controller-1",
        stores: {
          default: { phase: "playing" },
          scoreboard: { home: 2, away: 1 },
        },
      }),
    ).toEqual({
      phase: "playing",
      home: 2,
      away: 1,
    });
  });

  it("builds player actions from shared agent input definitions", () => {
    const action = agentAction.participant(
      {
        actionName: "setPointsToWin",
        storeDomain: "default",
      },
      {
        input: agentActionInput.number({
          payloadDescription: "Numeric points-to-win target.",
        }),
        toPayload: (pointsToWin) => ({
          pointsToWin,
        }),
        description: "Update the lobby win condition.",
        availability: "Lobby only.",
        resultDescription: "The host stores the new target score.",
      },
    );

    expect(action.target).toEqual({
      kind: "participant",
      actionName: "setPointsToWin",
      storeDomain: "default",
    });

    expect(describeAirJamAgentAction(action)).toEqual({
      description: "Update the lobby win condition.",
      payload: {
        kind: "number",
        description: "Numeric points-to-win target.",
      },
      resultDescription: "The host stores the new target score.",
    });

    expect(
      resolveAirJamAgentActionPayload(action, "7", {
        gameId: "pong",
        actionName: "set_points_to_win",
        contractKind: "agent",
      }),
    ).toEqual({
      pointsToWin: 7,
    });
  });

  it("supports custom JSON inputs without a parallel legacy contract shape", () => {
    const action = agentAction.participant(
      {
        actionName: "setBotCount",
        storeDomain: "default",
      },
      {
        input: agentActionInput.custom(
          {
            payloadKind: "json",
            payloadDescription:
              'A JSON object like {"team":"team1","count":2}.',
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
        description: "Adjust one team bot count.",
        resultDescription: "The requested team bot count updates.",
      },
    );

    expect(describeAirJamAgentAction(action)).toEqual({
      description: "Adjust one team bot count.",
      payload: {
        kind: "json",
        description: 'A JSON object like {"team":"team1","count":2}.',
      },
      resultDescription: "The requested team bot count updates.",
    });

    expect(
      resolveAirJamAgentActionPayload(action, { team: "team2", count: 3 }, {
        gameId: "code-review",
        actionName: "set_bot_count",
        contractKind: "agent",
      }),
    ).toEqual({
      team: "team2",
      count: 3,
    });
  });

  it("supports Zod-backed agent action inputs directly", () => {
    const action = agentAction.participant(
      {
        actionName: "setBotCount",
        storeDomain: "default",
      },
      {
        input: agentActionInput.zod(
          z.object({
            team: z.enum(["team1", "team2"]),
            count: z.number().int().min(0).max(4),
          }),
          {
            payloadDescription:
              'A JSON object like {"team":"team1","count":2}.',
          },
        ),
        description: "Adjust one team bot count.",
        resultDescription: "The requested team bot count updates.",
      },
    );

    expect(describeAirJamAgentAction(action)).toEqual({
      description: "Adjust one team bot count.",
      payload: {
        kind: "json",
        description: 'A JSON object like {"team":"team1","count":2}.',
      },
      resultDescription: "The requested team bot count updates.",
    });

    expect(
      resolveAirJamAgentActionPayload(action, { team: "team2", count: 3 }, {
        gameId: "code-review",
        actionName: "set_bot_count",
        contractKind: "agent",
      }),
    ).toEqual({
      team: "team2",
      count: 3,
    });

    expect(() =>
      resolveAirJamAgentActionPayload(action, { team: "team3", count: 3 }, {
        gameId: "code-review",
        actionName: "set_bot_count",
        contractKind: "agent",
      }),
    ).toThrow(/Invalid option/);
  });
});
