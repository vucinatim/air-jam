/**
 * The Office's authoritative simulation, stepped by the SDK clock on the host.
 * It owns everything that decides the match: movement, tasks and breaks,
 * energy and boredom, deaths, expiring orders and the match clock. The host
 * screen only draws it and turns its events into toasts and sounds, so the
 * match also runs headless and faster than real time.
 */
import { defineAirJamSimulation } from "@air-jam/sdk/core";
import { getPlayerById, getTaskDurationMs } from "../content/players";
import type { GameInput } from "../contracts/input";
import {
  BREAKROOM_LOCATIONS,
  LOCATIONS,
  STAT_CONSTANTS,
  TaskManager,
  type ActiveTask,
  type Location,
} from "../domain/task-manager";
import { spaceStore, type PlayerStats } from "../stores";
import {
  circlesOverlap,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  isNearLocation,
  isValidPosition,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SPAWN_POSITIONS,
} from "./office-layout";

export const OFFICE_STEP_MS = 1000 / 60;
const TASK_COOLDOWN_MS = 1000;
const ORDER_PENALTY = 100;

export interface BreakroomActivity {
  locationId: string;
  startTime: number;
}

export interface OfficeSimulationState {
  positions: Record<string, { x: number; y: number }>;
  lastAction: Record<string, boolean>;
  lastTaskCompleteTime: Record<string, number>;
  usedSpawnIndices: number[];
  tasks: TaskManager;
  /** Open orders for the sidebar, refreshed twice a second. */
  pendingTasks: ActiveTask[];
  breaks: Record<string, BreakroomActivity | null>;
  boredomDecayAt: Record<string, number>;
  /** Match time played so far. */
  elapsedMs: number;
  lastTaskUpdate: number;
  lastStatUpdate: number;
  lastTaskCount: number;
  roster: string;
  matchPhase: ReturnType<typeof spaceStore.getState>["matchPhase"];
  lifecycleVersion: number;
}

export type OfficeSimulationEvent =
  | { type: "task-started"; playerId: string; taskName: string }
  | { type: "task-completed"; playerId: string; taskName: string }
  | { type: "break-finished"; playerId: string; locationId: string }
  | { type: "player-died"; playerId: string; cause: "energy" | "boredom" }
  | { type: "orders-expired"; count: number }
  | { type: "new-order" };

type Emit = (event: OfficeSimulationEvent) => void;

const BREAK_NAMES: Record<string, string> = {
  "coffee-machine": "Pijem kavo",
  "lunch-spot": "Jem malico",
  "fifa-table": "Igram FIFA",
  "rest-sramote": "Počivam",
  "couch-jok": "Počivam",
  "couch-kuhinja": "Počivam",
};

const resetMatch = (sim: OfficeSimulationState, playerIds: string[]) => {
  sim.positions = {};
  sim.lastAction = {};
  sim.lastTaskCompleteTime = {};
  sim.usedSpawnIndices = [];
  sim.tasks.reset();
  sim.pendingTasks = [];
  sim.lastTaskUpdate = 0;
  sim.lastStatUpdate = 0;
  sim.lastTaskCount = 0;
  sim.breaks = Object.fromEntries(playerIds.map((id) => [id, null]));
  sim.boredomDecayAt = Object.fromEntries(playerIds.map((id) => [id, 0]));
};

/** Drops players who left and gives new players a free spawn point. */
const placePlayers = (
  sim: OfficeSimulationState,
  playerIds: string[],
  random: () => number,
) => {
  const connected = new Set(playerIds);
  for (const record of [
    sim.positions,
    sim.lastAction,
    sim.lastTaskCompleteTime,
    sim.breaks,
    sim.boredomDecayAt,
  ])
    for (const playerId of Object.keys(record))
      if (!connected.has(playerId)) delete record[playerId];

  for (const playerId of playerIds) {
    if (sim.positions[playerId]) continue;
    const index = SPAWN_POSITIONS.findIndex(
      (_, candidate) => !sim.usedSpawnIndices.includes(candidate),
    );
    if (index !== -1) {
      sim.usedSpawnIndices.push(index);
      sim.positions[playerId] = { ...SPAWN_POSITIONS[index] };
      continue;
    }
    let x: number;
    let y: number;
    let attempts = 0;
    do {
      x = PLAYER_RADIUS + random() * (FIELD_WIDTH - PLAYER_RADIUS * 2);
      y = PLAYER_RADIUS + random() * (FIELD_HEIGHT - PLAYER_RADIUS * 2);
      attempts += 1;
    } while (!isValidPosition(x, y, PLAYER_RADIUS) && attempts < 50);
    sim.positions[playerId] = { x, y };
  }
};

const move = (
  sim: OfficeSimulationState,
  playerId: string,
  input: GameInput,
  playerIds: string[],
) => {
  const position = sim.positions[playerId];
  if (!position) return;
  const nextX = position.x + input.move.x * PLAYER_SPEED;
  // The stick's y is up; the office's y runs down the screen.
  const nextY = position.y - input.move.y * PLAYER_SPEED;
  const free = (x: number, y: number) =>
    isValidPosition(x, y, PLAYER_RADIUS) &&
    !playerIds.some((otherId) => {
      const other = otherId === playerId ? null : sim.positions[otherId];
      return (
        other &&
        circlesOverlap(x, y, PLAYER_RADIUS, other.x, other.y, PLAYER_RADIUS)
      );
    });
  if (free(nextX, nextY)) {
    position.x = nextX;
    position.y = nextY;
  } else if (free(nextX, position.y)) position.x = nextX;
  else if (free(position.x, nextY)) position.y = nextY;
};

/** Starts the order waiting at a location the player stands at, if allowed. */
const startTaskAt = (
  sim: OfficeSimulationState,
  playerId: string,
  locations: Location[],
  elapsedMs: number,
  emit: Emit,
): "started" | "refused" | "none" => {
  const position = sim.positions[playerId];
  const location = locations.find((candidate) =>
    isNearLocation(position.x, position.y, candidate.id, locations),
  );
  if (!location) return "none";
  const task = sim.tasks.getTaskAt(location.id);
  if (!task) return "none";
  const player = getPlayerById(
    spaceStore.getState().playerAssignments[playerId],
  );
  if (
    !player ||
    sim.tasks.isDoingTask(playerId) ||
    elapsedMs - (sim.lastTaskCompleteTime[playerId] ?? 0) < TASK_COOLDOWN_MS
  )
    return "refused";
  if (
    !sim.tasks.startTask(
      playerId,
      location.id,
      getTaskDurationMs(task.taskDefId, player.id),
      elapsedMs,
    )
  )
    return "refused";
  void spaceStore.actions.setBusy({ playerId, taskName: task.name });
  emit({ type: "task-started", playerId, taskName: task.name });
  return "started";
};

const startBreak = (
  sim: OfficeSimulationState,
  playerId: string,
  elapsedMs: number,
  emit: Emit,
) => {
  if (sim.breaks[playerId]) return;
  const position = sim.positions[playerId];
  const breakrooms = BREAKROOM_LOCATIONS as Location[];
  const location = breakrooms.find((candidate) =>
    isNearLocation(position.x, position.y, candidate.id, breakrooms),
  );
  if (!location || !spaceStore.getState().playerStats[playerId]?.alive) return;
  // An order at the coffee machine is work, not a break.
  if (startTaskAt(sim, playerId, [location], elapsedMs, emit) !== "none")
    return;
  sim.breaks[playerId] = { locationId: location.id, startTime: elapsedMs };
  void spaceStore.actions.setBusy({
    playerId,
    taskName: BREAK_NAMES[location.id] ?? "",
  });
};

const finishBreak = (
  sim: OfficeSimulationState,
  playerId: string,
  elapsedMs: number,
  emit: Emit,
) => {
  const activity = sim.breaks[playerId];
  if (
    !activity ||
    elapsedMs - activity.startTime <
      STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS
  )
    return;
  const { locationId } = activity;
  if (locationId === "coffee-machine")
    void spaceStore.actions.restoreEnergy({
      playerId,
      amount: STAT_CONSTANTS.COFFEE_ENERGY_RESTORE,
    });
  else if (locationId === "fifa-table")
    void spaceStore.actions.restoreBoredom({
      playerId,
      amount: STAT_CONSTANTS.FIFA_BOREDOM_RESTORE,
    });
  else
    void spaceStore.actions.restoreEnergy({
      playerId,
      amount: STAT_CONSTANTS.LUNCH_ENERGY_RESTORE,
    });
  sim.breaks[playerId] = null;
  void spaceStore.actions.setBusy({ playerId, taskName: null });
  emit({ type: "break-finished", playerId, locationId });
};

const nextStats = (
  sim: OfficeSimulationState,
  playerId: string,
  elapsedMs: number,
  random: () => number,
  emit: Emit,
): Partial<PlayerStats> | null => {
  const stats = spaceStore.getState().playerStats[playerId];
  if (!stats?.alive || sim.breaks[playerId]) return null;
  const energy = Math.max(
    0,
    stats.energy - STAT_CONSTANTS.ENERGY_DECAY_PER_SECOND,
  );
  let boredom = stats.boredom;
  if (elapsedMs > (sim.boredomDecayAt[playerId] ?? 0)) {
    boredom = Math.max(
      0,
      stats.boredom -
        (STAT_CONSTANTS.BOREDOM_DECAY_MIN +
          random() *
            (STAT_CONSTANTS.BOREDOM_DECAY_MAX -
              STAT_CONSTANTS.BOREDOM_DECAY_MIN)),
    );
    sim.boredomDecayAt[playerId] =
      elapsedMs +
      STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MIN_MS +
      random() *
        (STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MAX_MS -
          STAT_CONSTANTS.BOREDOM_DECAY_INTERVAL_MIN_MS);
  }
  if (energy <= 0 || boredom <= 0) {
    emit({
      type: "player-died",
      playerId,
      cause: energy <= 0 ? "energy" : "boredom",
    });
    return { energy: 0, boredom: 0, alive: false };
  }
  return energy === stats.energy && boredom === stats.boredom
    ? null
    : { energy, boredom };
};

/** Plays one step of a running match at `elapsedMs` of match time. */
export const advanceOfficeMatch = (
  sim: OfficeSimulationState,
  {
    elapsedMs,
    playerIds,
    input,
    random,
    emit,
  }: {
    elapsedMs: number;
    playerIds: string[];
    input: (playerId: string) => GameInput;
    random: () => number;
    emit: Emit;
  },
): void => {
  const { gameOver, gameDurationMs } = spaceStore.getState();
  if (gameOver) return;
  if (elapsedMs >= gameDurationMs) {
    void spaceStore.actions.finishMatch();
    return;
  }

  const expired = sim.tasks.update(elapsedMs, random);
  if (expired.length > 0) {
    void spaceStore.actions.applyPenalty({
      amount: expired.length * ORDER_PENALTY,
    });
    emit({ type: "orders-expired", count: expired.length });
  }
  if (elapsedMs - sim.lastTaskUpdate > 500) {
    const tasks = sim.tasks.getTasks();
    if (tasks.length > sim.lastTaskCount) emit({ type: "new-order" });
    sim.lastTaskCount = tasks.length;
    sim.pendingTasks = tasks;
    sim.lastTaskUpdate = elapsedMs;
  }

  const updateStats = elapsedMs - sim.lastStatUpdate > 1000;
  const progressByPlayerId: Record<string, number> = {};
  const updatesByPlayerId: Record<string, Partial<PlayerStats>> = {};
  for (const playerId of playerIds) {
    if (!sim.positions[playerId]) continue;
    const playerInput = input(playerId);
    const working = sim.tasks.isDoingTask(playerId);
    const activity = sim.breaks[playerId];
    if (working)
      progressByPlayerId[playerId] = sim.tasks.getTaskProgress(
        playerId,
        elapsedMs,
      );
    else if (activity)
      progressByPlayerId[playerId] = Math.min(
        (elapsedMs - activity.startTime) /
          STAT_CONSTANTS.BREAKROOM_ACTIVITY_DURATION_MS,
        1,
      );
    // Input controls intent, not whether the host advances this player.
    if (!working) move(sim, playerId, playerInput, playerIds);
    if (playerInput.action && !sim.lastAction[playerId])
      if (startTaskAt(sim, playerId, LOCATIONS, elapsedMs, emit) !== "started")
        startBreak(sim, playerId, elapsedMs, emit);

    const completed = sim.tasks.completeTask(playerId, elapsedMs);
    if (completed) {
      void spaceStore.actions.completeTask({
        playerId,
        reward: completed.reward,
      });
      void spaceStore.actions.setBusy({ playerId, taskName: null });
      sim.lastTaskCompleteTime[playerId] = elapsedMs;
      emit({ type: "task-completed", playerId, taskName: completed.name });
    }
    finishBreak(sim, playerId, elapsedMs, emit);
    if (updateStats) {
      const stats = nextStats(sim, playerId, elapsedMs, random, emit);
      if (stats) updatesByPlayerId[playerId] = stats;
    }
    sim.lastAction[playerId] = playerInput.action;
  }

  if (Object.keys(progressByPlayerId).length > 0)
    void spaceStore.actions.setTaskProgressBatch({ progressByPlayerId });
  if (Object.keys(updatesByPlayerId).length > 0)
    void spaceStore.actions.updatePlayerStatsBatch({ updatesByPlayerId });
  if (updateStats) sim.lastStatUpdate = elapsedMs;

  const { playerStats } = spaceStore.getState();
  if (
    playerIds.length > 0 &&
    playerIds.every((playerId) => playerStats[playerId]?.alive === false)
  )
    void spaceStore.actions.finishMatch();
};

export const officeSimulation = defineAirJamSimulation<
  OfficeSimulationState,
  GameInput,
  OfficeSimulationEvent
>({
  stepMs: OFFICE_STEP_MS,
  create: () => {
    const { matchPhase, lifecycleVersion } = spaceStore.getState();
    return {
      positions: {},
      lastAction: {},
      lastTaskCompleteTime: {},
      usedSpawnIndices: [],
      tasks: new TaskManager(),
      pendingTasks: [],
      breaks: {},
      boredomDecayAt: {},
      elapsedMs: 0,
      lastTaskUpdate: 0,
      lastStatUpdate: 0,
      lastTaskCount: 0,
      roster: "",
      matchPhase,
      lifecycleVersion,
    };
  },
  step: (sim, context) => {
    const { matchPhase, lifecycleVersion, gameDurationMs } =
      spaceStore.getState();
    const playerIds = context.players.map((player) => player.id);
    const roster = playerIds.join("\u0000");
    const lifecycleChanged =
      matchPhase !== sim.matchPhase ||
      lifecycleVersion !== sim.lifecycleVersion;
    // A new match restarts the clock; the end of a match keeps its time.
    if (lifecycleVersion !== sim.lifecycleVersion) sim.elapsedMs = 0;
    if (lifecycleChanged) {
      resetMatch(sim, playerIds);
      sim.matchPhase = matchPhase;
      sim.lifecycleVersion = lifecycleVersion;
    }
    if ((lifecycleChanged || roster !== sim.roster) && matchPhase !== "ended") {
      void spaceStore.actions.syncConnectedPlayers({
        connectedPlayerIds: playerIds,
      });
      placePlayers(sim, playerIds, context.random);
    }
    sim.roster = roster;

    if (matchPhase !== "playing" || context.runtimeState !== "playing") return;
    sim.elapsedMs = Math.min(sim.elapsedMs + context.stepMs, gameDurationMs);
    advanceOfficeMatch(sim, {
      elapsedMs: sim.elapsedMs,
      playerIds,
      input: context.input,
      random: context.random,
      emit: context.emit,
    });
  },
  // Positions, tasks and breaks live only in the simulation; agents read them here.
  observe: (sim) => ({
    timeLeftMs: Math.max(
      0,
      Math.round(spaceStore.getState().gameDurationMs - sim.elapsedMs),
    ),
    coworkers: Object.entries(sim.positions).map(([playerId, position]) => ({
      playerId,
      x: Math.round(position.x),
      y: Math.round(position.y),
      doingTask: sim.tasks.isDoingTask(playerId),
      holdingAction: sim.lastAction[playerId] ?? false,
      onBreakAt: sim.breaks[playerId]?.locationId ?? null,
    })),
    tasks: sim.tasks.getTasks().map((task) => ({
      taskId: task.taskDefId,
      name: task.name,
      reward: task.reward,
      locationId: task.locationId,
      expiresInMs: Math.max(
        0,
        Math.round(
          task.spawnTime + STAT_CONSTANTS.TASK_EXPIRY_MS - sim.elapsedMs,
        ),
      ),
    })),
  }),
});
