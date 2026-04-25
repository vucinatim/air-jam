import { describe, expect, it } from "vitest";
import {
  assignmentsEqual,
  canJoinTeam,
  normalizeAssignments,
  pruneDisconnectedAssignments,
} from "../../../src/game/domain/team-assignments";

describe("team assignments", () => {
  it("normalizes positions within each team", () => {
    const normalized = normalizeAssignments({
      alpha: { team: "team1", position: "back" },
      beta: { team: "team1", position: "front" },
      gamma: { team: "team2", position: "front" },
    });

    expect(normalized).toEqual({
      beta: { team: "team1", position: "front" },
      alpha: { team: "team1", position: "back" },
      gamma: { team: "team2", position: "front" },
    });
  });

  it("prunes disconnected players while retaining the acting player", () => {
    const pruned = pruneDisconnectedAssignments(
      {
        alpha: { team: "team1", position: "front" },
        beta: { team: "team1", position: "back" },
        gamma: { team: "team2", position: "front" },
      },
      ["beta"],
      "alpha",
    );

    expect(pruned).toEqual({
      alpha: { team: "team1", position: "front" },
      beta: { team: "team1", position: "back" },
    });
  });

  it("detects when a team is full", () => {
    expect(
      canJoinTeam(
        {
          alpha: { team: "team1", position: "front" },
          beta: { team: "team1", position: "back" },
        },
        "team1",
      ),
    ).toBe(false);

    expect(
      canJoinTeam(
        {
          alpha: { team: "team1", position: "front" },
        },
        "team1",
      ),
    ).toBe(true);
  });

  it("compares assignment maps structurally", () => {
    const left = {
      alpha: { team: "team1", position: "front" },
      beta: { team: "team2", position: "front" },
    } as const;

    expect(assignmentsEqual(left, { ...left })).toBe(true);
    expect(
      assignmentsEqual(left, {
        alpha: { team: "team1", position: "back" },
        beta: { team: "team2", position: "front" },
      }),
    ).toBe(false);
  });
});
