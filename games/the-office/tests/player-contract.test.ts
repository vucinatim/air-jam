import { airJamDecisionQuestionSchema } from "@air-jam/devtools/testing";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { describe, expect, it } from "vitest";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  isValidPosition,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPAWN_POSITIONS,
} from "../src/game/engine/office-layout";
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

/** The host's own movement: a held direction, sliding along walls. */
function walk(
  from: { x: number; y: number },
  locationId: string,
  decisionTicks: number,
  maximumTicks: number,
) {
  const position = { ...from };
  let direction = { x: 0, y: 0 };
  for (let tick = 0; tick < maximumTicks; tick++) {
    if (tick % decisionTicks === 0) {
      const route = routeTo(position, locationId);
      if (!route) return false;
      if (route.arrived) return true;
      direction = { x: route.movementX, y: route.movementY };
    }
    const x = position.x + direction.x * PLAYER_SPEED;
    const y = position.y + direction.y * PLAYER_SPEED;
    if (isValidPosition(x, y, PLAYER_RADIUS)) Object.assign(position, { x, y });
    else if (isValidPosition(x, position.y, PLAYER_RADIUS)) position.x = x;
    else if (isValidPosition(position.x, y, PLAYER_RADIUS)) position.y = y;
  }
  return false;
}

describe("The Office navigation", () => {
  it("actually walks every route under the game's movement, holding each step for a whole decision", () => {
    // From everywhere a coworker can stand, a decision every 200 ms at 60
    // simulation steps a second reaches every location within 30 s.
    const starts = [];
    for (let x = 30; x < FIELD_WIDTH; x += 50)
      for (let y = 30; y < FIELD_HEIGHT; y += 50)
        // Inside the office: a place a coworker can stand with a way out.
        if (
          isValidPosition(x, y, PLAYER_RADIUS) &&
          routeTo({ x, y }, "meeting-table")
        )
          starts.push({ x, y });
    expect(starts.length).toBeGreaterThan(50);
    for (const start of starts)
      for (const location of ALL_LOCATIONS)
        expect(
          walk(start, location.id, 12, 1800),
          `${JSON.stringify(start)} to ${location.id}`,
        ).toBe(true);
  });

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
    airJamDecisionQuestionSchema.parse(turn);
    expect(turn?.state[0]).toBe(
      "About 120 seconds of the workday are left and the team has earned 800.",
    );
    expect(turn?.state[2]).toMatch(
      /^Task "Maili" at Meeting Table pays 200, expires in 30 s, takes me 4 s and is \d+ s away\.$/,
    );
    expect(Object.keys(turn?.options ?? {})).toEqual([
      "do-meeting-table",
      "coffee",
      "lunch",
      "fifa",
      "wait",
    ]);
    expect(turn?.options["do-meeting-table"]?.control).toMatchObject({
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
    expect(pressing?.options["do-meeting-table"]?.control).toEqual({
      kind: "input",
      input: { movementX: 0, movementY: 0, action: true },
    });
    const held = officePlayer.turn({
      observation: observe("playing", { ...beside, holdingAction: true }),
      seatId: "player",
    });
    expect(held?.options["do-meeting-table"]?.control).toMatchObject({
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
