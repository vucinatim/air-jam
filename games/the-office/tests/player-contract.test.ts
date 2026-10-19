import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { describe, expect, it } from "vitest";
import { SPAWN_POSITIONS } from "../src/game/engine/office-layout";
import { ALL_LOCATIONS, routeTo } from "../src/testing/navigation";
import { officePlayer } from "../src/testing/player";

const snapshot = (
  phase: string,
  stats = { energy: 80, boredom: 60, alive: true },
) => ({
  phase,
  lobby: {
    availablePlayers: [
      { id: "spela", name: "Špela", selectedByControllerId: "human", stats },
    ],
  },
  mySelection: { playerId: "spela", name: "Špela" },
  scoreboard: { totalMoney: 900, totalMoneyPenalty: 100, finalTotalMoney: 800 },
});
const observe = (
  phase: string,
  coworker: Record<string, unknown> = {},
  stats?: { energy: number; boredom: number; alive: boolean },
) =>
  ({
    controllerId: "human",
    snapshot: snapshot(phase, stats),
    runtime: {
      timeLeftMs: 120_000,
      coworkers: [
        {
          playerId: "human",
          ...SPAWN_POSITIONS[0],
          doingTask: false,
          holdingAction: false,
          onBreakAt: null,
          ...coworker,
        },
      ],
      tasks: [
        {
          taskId: "maili",
          name: "Maili",
          reward: 200,
          locationId: "meeting-table",
          expiresInMs: 30_000,
        },
      ],
    },
  }) as unknown as HostObservation;

describe("The Office navigation", () => {
  it("reaches every task station and break spot from every spawn point", () => {
    for (const spawn of SPAWN_POSITIONS)
      for (const location of ALL_LOCATIONS)
        expect(routeTo(spawn, location.id), location.id).not.toBeNull();
  });
});

describe("The Office player contract", () => {
  it("offers each open task and break as a walk, plus waiting", () => {
    const turn = officePlayer.turn({
      observation: observe("playing"),
      seatId: "player",
    });
    expect(turn?.state[0]).toBe(
      "About 120 seconds of the workday are left and the team has earned 800.",
    );
    expect(turn?.state[2]).toMatch(
      /^Task "Maili" at Meeting Table pays 200, expires in 30 s, takes me 4 s and is \d+ s away\.$/,
    );
    expect(Object.keys(turn?.options ?? {})).toEqual([
      "task:meeting-table",
      "coffee",
      "lunch",
      "fifa",
      "wait",
    ]);
    expect(turn?.options["task:meeting-table"]?.control).toMatchObject({
      kind: "input",
      input: { action: false },
    });
  });

  it("presses the action button only as a fresh press once there", () => {
    const table = ALL_LOCATIONS.find(
      (location) => location.id === "meeting-table",
    )!;
    const beside = {
      x: table.x + table.width / 2,
      y: table.y + table.height + 30,
    };
    const pressing = officePlayer.turn({
      observation: observe("playing", beside),
      seatId: "player",
    });
    expect(pressing?.options["task:meeting-table"]?.control).toEqual({
      kind: "input",
      input: { movementX: 0, movementY: 0, action: true },
    });
    const held = officePlayer.turn({
      observation: observe("playing", { ...beside, holdingAction: true }),
      seatId: "player",
    });
    expect(held?.options["task:meeting-table"]?.control).toMatchObject({
      input: { action: false },
    });
  });

  it("has nothing to decide while busy, out, or outside a shift", () => {
    for (const observation of [
      observe("lobby"),
      observe("playing", { doingTask: true }),
      observe("playing", { onBreakAt: "fifa-table" }),
      observe("playing", {}, { energy: 0, boredom: 0, alive: false }),
    ])
      expect(officePlayer.turn({ observation, seatId: "player" })).toBeNull();
  });
});
