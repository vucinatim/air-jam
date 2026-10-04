// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYERS } from "../../src/game/content/players";
import type { GameInput } from "../../src/game/contracts/input";
import { LOCATIONS, STAT_CONSTANTS } from "../../src/game/domain/task-manager";
import type { PlayerStats } from "../../src/game/stores/types";
import { useOfficeGameRuntime } from "../../src/host/hooks/use-office-game-runtime";

const fixture = vi.hoisted(() => ({
  state: {
    playerAssignments: {} as Record<string, string>,
    playerStats: {} as Record<string, PlayerStats>,
  },
  actions: {
    syncConnectedPlayers: vi.fn(),
    finishMatch: vi.fn(),
    applyPenalty: vi.fn(),
    setBusy: vi.fn(),
    completeTask: vi.fn(),
    restoreEnergy: vi.fn(),
    restoreBoredom: vi.fn(),
    setTaskProgressBatch: vi.fn(),
    updatePlayerStatsBatch: vi.fn(),
  },
  sounds: {
    playTaskStart: vi.fn(),
    playTaskComplete: vi.fn(),
    playNewOrder: vi.fn(),
    playGameOver: vi.fn(),
    playOrderTimeout: vi.fn(),
  },
}));

vi.mock("../../src/game/stores", () => ({
  useSpaceStore: Object.assign(
    (selector: (state: typeof fixture.state) => unknown) =>
      selector(fixture.state),
    { useActions: () => fixture.actions },
  ),
  useOfficeGameDurationMs: () => 300_000,
  useOfficeGameOver: () => false,
  useOfficeLifecycleVersion: () => 1,
  useOfficeMatchPhase: () => "playing",
}));
vi.mock("../../src/host/hooks/use-office-sounds", () => ({
  useOfficeSounds: () => fixture.sounds,
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const playerIds = ["never-input", "neutral-input"];
const players = playerIds.map((id) => ({ id }));
const neutral: GameInput = { movementX: 0, movementY: 0, action: false };

describe("Office autonomous host simulation", () => {
  let root: Root;
  let container: HTMLDivElement;
  let runtime: ReturnType<typeof useOfficeGameRuntime>;

  function Harness() {
    const value = useOfficeGameRuntime({ connectedPlayerIds: playerIds });
    useEffect(() => {
      runtime = value;
    }, [value]);
    return null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    fixture.state.playerAssignments = Object.fromEntries(
      playerIds.map((id, index) => [id, PLAYERS[index].id]),
    );
    fixture.state.playerStats = Object.fromEntries(
      playerIds.map((id) => [id, { energy: 100, boredom: 100, alive: true }]),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Harness />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const update = (
    time: number,
    input: (id: string) => GameInput | null = () => null,
    playing = true,
  ) => {
    act(() => runtime.updateGame(time, players, input, playing));
  };

  it("decays never-input and neutral-input players equally without moving or starting work", () => {
    runtime.taskManagerRef.current.spawnTask(0);
    const task = runtime.taskManagerRef.current.getTasks()[0];
    const location = LOCATIONS.find(
      (candidate) => candidate.id === task.locationId,
    )!;
    runtime.gameStateRef.current.positions["never-input"] = {
      x: location.x,
      y: location.y,
    };
    const positions = structuredClone(runtime.gameStateRef.current.positions);
    const startTask = vi.spyOn(runtime.taskManagerRef.current, "startTask");

    update(1001, (id) => (id === "neutral-input" ? neutral : null));
    update(2002, (id) => (id === "neutral-input" ? neutral : null));

    expect(runtime.gameStateRef.current.playerStats["never-input"]).toEqual(
      runtime.gameStateRef.current.playerStats["neutral-input"],
    );
    expect(runtime.gameStateRef.current.playerStats["never-input"].energy).toBe(
      100 - 2 * STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND,
    );
    expect(runtime.gameStateRef.current.positions).toEqual(positions);
    expect(startTask).not.toHaveBeenCalled();
    expect(fixture.actions.setBusy).not.toHaveBeenCalled();
  });

  it("advances and completes an active task even when input is absent", () => {
    const manager = runtime.taskManagerRef.current;
    manager.spawnTask(0);
    const task = manager.getTasks()[0];
    expect(manager.startTask("never-input", task.locationId, 2000, 0)).toBe(
      true,
    );

    update(1000);
    expect(fixture.actions.setTaskProgressBatch).toHaveBeenLastCalledWith({
      progressByPlayerId: { "never-input": 0.5 },
    });
    expect(fixture.actions.completeTask).not.toHaveBeenCalled();
    update(2000);
    expect(fixture.actions.completeTask).toHaveBeenCalledWith({
      playerId: "never-input",
      reward: task.reward,
    });
    expect(fixture.actions.setBusy).toHaveBeenCalledWith({
      playerId: "never-input",
      taskName: null,
    });
    expect(manager.isDoingTask("never-input")).toBe(false);
    expect(
      runtime.gameStateRef.current.lastTaskCompleteTime["never-input"],
    ).toBe(2000);
  });

  it("advances and completes an active coffee break even when input is absent", () => {
    runtime.breakroomActivitiesRef.current["never-input"] = {
      locationId: "coffee-machine",
      startTime: 0,
    };
    update(STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS / 2);
    expect(fixture.actions.setTaskProgressBatch).toHaveBeenLastCalledWith({
      progressByPlayerId: { "never-input": 0.5 },
    });
    expect(fixture.actions.restoreEnergy).not.toHaveBeenCalled();
    update(STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS);
    expect(fixture.actions.restoreEnergy).toHaveBeenCalledWith({
      playerId: "never-input",
      amount: STAT_CONSTANTS.COFFEE_ENERGY_RESTORE,
    });
    expect(runtime.breakroomActivitiesRef.current["never-input"]).toBeNull();
    expect(fixture.actions.setBusy).toHaveBeenCalledWith({
      playerId: "never-input",
      taskName: null,
    });
  });

  it("does not advance stats, task progress or break completion while paused", () => {
    const manager = runtime.taskManagerRef.current;
    manager.spawnTask(0);
    expect(
      manager.startTask(
        "never-input",
        manager.getTasks()[0].locationId,
        2000,
        0,
      ),
    ).toBe(true);
    runtime.breakroomActivitiesRef.current["neutral-input"] = {
      locationId: "coffee-machine",
      startTime: 0,
    };
    const stats = structuredClone(runtime.gameStateRef.current.playerStats);
    update(10_000, () => null, false);
    expect(runtime.gameStateRef.current.playerStats).toEqual(stats);
    expect(manager.isDoingTask("never-input")).toBe(true);
    expect(
      runtime.breakroomActivitiesRef.current["neutral-input"],
    ).not.toBeNull();
    expect(fixture.actions.updatePlayerStatsBatch).not.toHaveBeenCalled();
    expect(fixture.actions.setTaskProgressBatch).not.toHaveBeenCalled();
    expect(fixture.actions.completeTask).not.toHaveBeenCalled();
    expect(fixture.actions.restoreEnergy).not.toHaveBeenCalled();
  });

  it("ends the match once when every no-input player dies from normal stat decay", () => {
    for (const stats of Object.values(
      runtime.gameStateRef.current.playerStats,
    )) {
      stats.energy = STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND;
    }
    update(1001);
    update(2002);
    for (const stats of Object.values(
      runtime.gameStateRef.current.playerStats,
    )) {
      expect(stats).toEqual({ energy: 0, boredom: 0, alive: false });
    }
    expect(fixture.actions.finishMatch).toHaveBeenCalledTimes(1);
  });
});
