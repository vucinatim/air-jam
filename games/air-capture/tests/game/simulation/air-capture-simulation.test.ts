// Runs in plain Node: the whole match, physics included, with no page.
import { createSeededRandom } from "@air-jam/sdk/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { botWorldSchema } from "../../../src/game/bot-system/bot-world";
import type { GameLoopInput } from "../../../src/game/contracts/input";
import { airCaptureSimulation } from "../../../src/game/simulation/air-capture-simulation";
import { teleportShip } from "../../../src/game/simulation/physics";
import type {
  AirCaptureEvent,
  AirCaptureSim,
} from "../../../src/game/simulation/state";

const fixture = vi.hoisted(() => ({
  state: {
    matchPhase: "lobby" as "lobby" | "countdown" | "playing" | "ended",
    pointsToWin: 3,
    botCounts: { solaris: 0, nebulon: 1 },
    teamAssignments: {} as Record<string, { teamId: "solaris" | "nebulon" }>,
  },
  actions: {
    syncConnectedPlayers: vi.fn(),
    setCountdownSeconds: vi.fn(),
    finishCountdown: vi.fn(),
    endMatch: vi.fn(),
  },
}));

vi.mock("../../../src/game/stores/match/match-store", () => ({
  prototypeMatchStore: {
    getState: () => fixture.state,
    actions: fixture.actions,
  },
}));

const HUMAN = "ctrl_1";
const idle: GameLoopInput = {
  vector: { x: 0, y: 0 },
  action: false,
  ability: false,
  timestamp: 0,
};

const createMatch = (seed = 7) => {
  const random = createSeededRandom(seed);
  const sim = airCaptureSimulation.create({ random });
  const events: AirCaptureEvent[] = [];
  let input: GameLoopInput = idle;
  const step = (count = 1) => {
    for (let index = 0; index < count; index += 1)
      airCaptureSimulation.step(sim, {
        tick: index,
        stepMs: airCaptureSimulation.stepMs,
        dtSeconds: airCaptureSimulation.stepMs / 1000,
        random,
        input: (controllerId) => (controllerId === HUMAN ? input : undefined),
        players: [{ id: HUMAN, label: "One", color: "#ffffff" }],
        runtimeState: "playing",
        emit: (event) => events.push(event),
      });
  };
  return {
    sim,
    events,
    step,
    hold: (next: Partial<GameLoopInput>) => {
      input = { ...idle, ...next };
    },
  };
};

const ship = (sim: AirCaptureSim, controllerId: string) => {
  const found = sim.ships.get(controllerId);
  if (!found) throw new Error(`No ship ${controllerId}.`);
  return found;
};

const moveShip = (
  sim: AirCaptureSim,
  controllerId: string,
  position: [number, number, number],
) => {
  const target = ship(sim, controllerId);
  teleportShip(target.body, position);
  target.position.set(...position);
  target.previousPosition.set(...position);
};

describe("Air Capture simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.state.matchPhase = "lobby";
    fixture.state.pointsToWin = 3;
    fixture.state.botCounts = { solaris: 0, nebulon: 1 };
    fixture.state.teamAssignments = { [HUMAN]: { teamId: "solaris" } };
    fixture.actions.finishCountdown.mockImplementation(() => {
      fixture.state.matchPhase = "playing";
    });
    fixture.actions.endMatch.mockImplementation(() => {
      fixture.state.matchPhase = "ended";
    });
  });

  it("puts the room's player and the lobby's bots on their teams at their bases", () => {
    const { sim, step } = createMatch();
    step();
    expect(ship(sim, HUMAN).teamId).toBe("solaris");
    const bots = [...sim.ships.values()].filter((each) => each.bot);
    expect(bots.map((bot) => bot.teamId)).toEqual(["nebulon"]);
    const base = sim.ctf.basePositions.solaris;
    expect(
      Math.hypot(
        ship(sim, HUMAN).position.x - base[0],
        ship(sim, HUMAN).position.z - base[2],
      ),
    ).toBeLessThan(10);
    expect(fixture.actions.syncConnectedPlayers).toHaveBeenCalledWith({
      connectedPlayerIds: [HUMAN],
    });
  });

  it("ends the countdown after three seconds of game time", () => {
    const { step } = createMatch();
    step();
    fixture.state.matchPhase = "countdown";
    step(170);
    expect(fixture.actions.finishCountdown).not.toHaveBeenCalled();
    step(20);
    expect(fixture.actions.finishCountdown).toHaveBeenCalledTimes(1);
  });

  it("flies a thrusting ship away from where it started", () => {
    const { sim, step, hold } = createMatch();
    step();
    fixture.state.matchPhase = "playing";
    step();
    const start = ship(sim, HUMAN).position.clone();
    hold({ vector: { x: 0, y: 1 } });
    step(60);
    expect(ship(sim, HUMAN).position.distanceTo(start)).toBeGreaterThan(5);
  });

  it("damages a ship a laser hits and marks the impact", () => {
    const { sim, step, hold, events } = createMatch();
    fixture.state.botCounts = { solaris: 0, nebulon: 0 };
    fixture.state.teamAssignments = {};
    step();
    fixture.state.matchPhase = "playing";
    step();
    // A second player stands straight ahead of the shooter.
    fixture.state.botCounts = { solaris: 0, nebulon: 1 };
    step();
    const bot = [...sim.ships.values()].find((each) => each.bot);
    if (!bot) throw new Error("No bot.");
    bot.bot = null;
    moveShip(sim, HUMAN, [0, 5, 0]);
    moveShip(sim, bot.controllerId, [0, 5, -20]);
    hold({ action: true });
    step();
    hold({});
    step(20);
    expect(bot.health).toBeLessThan(100);
    expect(events.some((event) => event.type === "impact")).toBe(true);
  });

  it("scores when a ship brings the enemy flag home, and ends the match at the target", () => {
    const { sim, step } = createMatch();
    fixture.state.botCounts = { solaris: 0, nebulon: 0 };
    fixture.state.pointsToWin = 1;
    step();
    fixture.state.matchPhase = "playing";
    step();
    moveShip(sim, HUMAN, sim.ctf.flags.nebulon.position);
    step();
    expect(sim.ctf.flags.nebulon).toMatchObject({
      status: "carried",
      carrierId: HUMAN,
    });
    const home = sim.ctf.basePositions.solaris;
    moveShip(sim, HUMAN, [home[0], 5, home[2]]);
    step();
    expect(sim.ctf.scores.solaris).toBe(1);
    expect(fixture.actions.endMatch).toHaveBeenCalledWith({
      winner: "solaris",
      finalScores: { solaris: 1, nebulon: 0 },
    });
  });

  it("replays the same match from the same seed and inputs", () => {
    const play = () => {
      fixture.state.matchPhase = "lobby";
      const match = createMatch(11);
      match.step();
      fixture.state.matchPhase = "playing";
      match.hold({ vector: { x: 0.4, y: 1 }, action: true });
      match.step(300);
      return {
        ships: [...match.sim.ships.values()].map((each) =>
          each.position.toArray().map((value) => value.toFixed(4)),
        ),
        collectibles: [...match.sim.collectibles.values()].map(
          (collectible) => collectible.position,
        ),
      };
    };
    expect(play()).toEqual(play());
  });

  it("observes the arena in the shape bots and agents read", () => {
    const { sim, step } = createMatch();
    step();
    const view = airCaptureSimulation.observe?.(sim, {
      controllerId: null,
      scope: "diagnostic",
    });
    expect(botWorldSchema.parse(view).ships).toHaveLength(2);
    expect(view).toMatchObject({ scores: { solaris: 0, nebulon: 0 } });
  });
});
