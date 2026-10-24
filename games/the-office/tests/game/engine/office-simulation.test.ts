import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYERS } from "../../../src/game/content/players";
import type { GameInput } from "../../../src/game/contracts/input";
import {
  LOCATIONS,
  STAT_CONSTANTS,
} from "../../../src/game/domain/task-manager";
import {
  advanceOfficeMatch,
  officeSimulation,
  type OfficeSimulationEvent,
  type OfficeSimulationState,
} from "../../../src/game/engine/office-simulation";
import { mergePlayerStatUpdates } from "../../../src/game/stores/space-store-helpers";
import type { PlayerStats } from "../../../src/game/stores/types";

const fixture = vi.hoisted(() => ({
  state: {
    matchPhase: "playing" as "lobby" | "playing" | "ended",
    lifecycleVersion: 1,
    gameDurationMs: 300_000,
    gameOver: false,
    playerAssignments: {} as Record<string, string>,
    playerStats: {} as Record<string, PlayerStats>,
  },
  actions: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock("../../../src/game/stores", () => ({
  spaceStore: {
    getState: () => fixture.state,
    get actions() {
      return fixture.actions;
    },
  },
}));

const playerIds = ["never-input", "neutral-input"];
const neutral: GameInput = { move: { x: 0, y: 0 }, action: false };
const random = () => 0;

describe("Office simulation", () => {
  let sim: OfficeSimulationState;
  let events: OfficeSimulationEvent[];

  beforeEach(() => {
    fixture.state.matchPhase = "playing";
    fixture.state.gameOver = false;
    fixture.state.playerAssignments = Object.fromEntries(
      playerIds.map((id, index) => [id, PLAYERS[index].id]),
    );
    fixture.state.playerStats = Object.fromEntries(
      playerIds.map((id) => [id, { energy: 100, boredom: 100, alive: true }]),
    );
    fixture.actions = Object.fromEntries(
      [
        "syncConnectedPlayers",
        "applyPenalty",
        "setBusy",
        "completeTask",
        "restoreEnergy",
        "restoreBoredom",
        "setTaskProgressBatch",
      ].map((name) => [name, vi.fn()]),
    );
    fixture.actions.updatePlayerStatsBatch = vi.fn(
      ({
        updatesByPlayerId,
      }: {
        updatesByPlayerId: Record<string, Partial<PlayerStats>>;
      }) => {
        fixture.state.playerStats = mergePlayerStatUpdates(
          fixture.state.playerStats,
          updatesByPlayerId,
        );
      },
    );
    fixture.actions.finishMatch = vi.fn(() => {
      fixture.state.gameOver = true;
    });
    sim = officeSimulation.create({ random });
    events = [];
    step("playing");
  });

  /** One simulation step as the SDK clock runs it. */
  const step = (runtimeState: "playing" | "paused") =>
    officeSimulation.step(sim, {
      tick: 1,
      stepMs: officeSimulation.stepMs,
      dtSeconds: officeSimulation.stepMs / 1000,
      random,
      input: () => neutral,
      players: playerIds.map((id) => ({ id, label: id, color: "#000000" })),
      runtimeState,
      emit: (event) => events.push(event),
    });

  const advance = (
    elapsedMs: number,
    input: (id: string) => GameInput = () => neutral,
  ) =>
    advanceOfficeMatch(sim, {
      elapsedMs,
      playerIds,
      input,
      random,
      emit: (event) => events.push(event),
    });

  it("places connected players and syncs the roster on the first step", () => {
    expect(Object.keys(sim.positions)).toEqual(playerIds);
    expect(fixture.actions.syncConnectedPlayers).toHaveBeenCalledWith({
      connectedPlayerIds: playerIds,
    });
  });

  it("decays idle players equally without moving or starting work", () => {
    sim.tasks.spawnTask(0, random);
    const task = sim.tasks.getTasks()[0];
    const location = LOCATIONS.find(
      (candidate) => candidate.id === task.locationId,
    );
    if (!location) throw new Error("Task has no location.");
    sim.positions["never-input"] = { x: location.x, y: location.y };
    const positions = structuredClone(sim.positions);
    const startTask = vi.spyOn(sim.tasks, "startTask");

    const input = () => neutral;
    advance(1001, input);
    advance(2002, input);

    expect(fixture.state.playerStats["never-input"]).toEqual(
      fixture.state.playerStats["neutral-input"],
    );
    expect(fixture.state.playerStats["never-input"].energy).toBe(
      100 - 2 * STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND,
    );
    expect(sim.positions).toEqual(positions);
    expect(startTask).not.toHaveBeenCalled();
    expect(fixture.actions.setBusy).not.toHaveBeenCalled();
  });

  it("advances and completes an active task even when input is absent", () => {
    sim.tasks.spawnTask(0, random);
    const task = sim.tasks.getTasks()[0];
    expect(sim.tasks.startTask("never-input", task.locationId, 2000, 0)).toBe(
      true,
    );

    advance(1000);
    expect(fixture.actions.setTaskProgressBatch).toHaveBeenLastCalledWith({
      progressByPlayerId: { "never-input": 0.5 },
    });
    expect(fixture.actions.completeTask).not.toHaveBeenCalled();
    advance(2000);
    expect(fixture.actions.completeTask).toHaveBeenCalledWith({
      playerId: "never-input",
      reward: task.reward,
    });
    expect(fixture.actions.setBusy).toHaveBeenCalledWith({
      playerId: "never-input",
      taskName: null,
    });
    expect(sim.tasks.isDoingTask("never-input")).toBe(false);
    expect(sim.lastTaskCompleteTime["never-input"]).toBe(2000);
    expect(events).toContainEqual({
      type: "task-completed",
      playerId: "never-input",
      taskName: task.name,
    });
  });

  it("advances and completes an active coffee break even when input is absent", () => {
    sim.breaks["never-input"] = { locationId: "coffee-machine", startTime: 0 };
    advance(STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS / 2);
    expect(fixture.actions.setTaskProgressBatch).toHaveBeenLastCalledWith({
      progressByPlayerId: { "never-input": 0.5 },
    });
    expect(fixture.actions.restoreEnergy).not.toHaveBeenCalled();
    advance(STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS);
    expect(fixture.actions.restoreEnergy).toHaveBeenCalledWith({
      playerId: "never-input",
      amount: STAT_CONSTANTS.COFFEE_ENERGY_RESTORE,
    });
    expect(sim.breaks["never-input"]).toBeNull();
    expect(events).toContainEqual({
      type: "break-finished",
      playerId: "never-input",
      locationId: "coffee-machine",
    });
  });

  it("does not advance the match clock, stats, task progress or breaks while paused", () => {
    sim.tasks.spawnTask(0, random);
    expect(
      sim.tasks.startTask(
        "never-input",
        sim.tasks.getTasks()[0].locationId,
        2000,
        0,
      ),
    ).toBe(true);
    sim.breaks["neutral-input"] = {
      locationId: "coffee-machine",
      startTime: 0,
    };
    const elapsedMs = sim.elapsedMs;
    const stats = structuredClone(fixture.state.playerStats);
    vi.clearAllMocks();
    for (let index = 0; index < 600; index += 1) step("paused");
    expect(sim.elapsedMs).toBe(elapsedMs);
    expect(fixture.state.playerStats).toEqual(stats);
    expect(sim.tasks.isDoingTask("never-input")).toBe(true);
    expect(sim.breaks["neutral-input"]).not.toBeNull();
    expect(fixture.actions.updatePlayerStatsBatch).not.toHaveBeenCalled();
    expect(fixture.actions.setTaskProgressBatch).not.toHaveBeenCalled();
  });

  it("ends the match once when every no-input player dies from normal stat decay", () => {
    for (const stats of Object.values(fixture.state.playerStats))
      stats.energy = STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND;
    advance(1001);
    advance(2002);
    for (const stats of Object.values(fixture.state.playerStats))
      expect(stats).toEqual({ energy: 0, boredom: 0, alive: false });
    expect(fixture.actions.finishMatch).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.type === "player-died")).toHaveLength(
      2,
    );
  });

  it("ends the match when the clock runs out", () => {
    sim.elapsedMs = fixture.state.gameDurationMs - officeSimulation.stepMs / 2;
    step("playing");
    expect(sim.elapsedMs).toBe(fixture.state.gameDurationMs);
    expect(fixture.actions.finishMatch).toHaveBeenCalledTimes(1);
  });

  it("keeps the match time when the match ends and restarts it for a new match", () => {
    for (let index = 0; index < 60; index += 1) step("playing");
    const played = sim.elapsedMs;
    expect(played).toBeGreaterThan(900);
    fixture.state.matchPhase = "ended";
    step("playing");
    expect(sim.elapsedMs).toBe(played);
    fixture.state.matchPhase = "playing";
    fixture.state.lifecycleVersion += 1;
    step("playing");
    expect(sim.elapsedMs).toBeCloseTo(officeSimulation.stepMs);
  });

  it("observes coworkers and open orders for agents", () => {
    sim.tasks.spawnTask(0, random);
    const view = officeSimulation.observe?.(sim, {
      controllerId: null,
      scope: "diagnostic",
    });
    expect(view).toMatchObject({
      timeLeftMs: expect.any(Number),
      coworkers: playerIds.map((playerId) =>
        expect.objectContaining({ playerId, doingTask: false }),
      ),
      tasks: [expect.objectContaining({ expiresInMs: expect.any(Number) })],
    });
  });
});
