import { getPlayerById } from "../../players";
import { createDefaultPlayerStats, pruneRecord } from "./space-store-helpers";
import type { SpaceGameState } from "./types";

type SpaceStoreSnapshot = Omit<SpaceGameState, "actions">;

const OFFICE_MATCH_DURATION_MS = 300000;

const createConnectedSet = (
  connectedPlayerIds: string[] | undefined,
): Set<string> => new Set(connectedPlayerIds ?? []);

const pruneConnectedState = (
  state: SpaceStoreSnapshot,
  connectedPlayerIds: string[] | undefined,
) => {
  const connectedSet = createConnectedSet(connectedPlayerIds);
  const nextMoney = pruneRecord(state.money, connectedSet);
  const nextAssignments = pruneRecord(state.playerAssignments, connectedSet);
  const nextBusyPlayers = pruneRecord(state.busyPlayers, connectedSet);
  const nextTaskProgress = pruneRecord(state.taskProgress, connectedSet);
  const nextPlayerStats = pruneRecord(state.playerStats, connectedSet);

  if (
    nextMoney === state.money &&
    nextAssignments === state.playerAssignments &&
    nextBusyPlayers === state.busyPlayers &&
    nextTaskProgress === state.taskProgress &&
    nextPlayerStats === state.playerStats
  ) {
    return state;
  }

  return {
    ...state,
    money: nextMoney,
    playerAssignments: nextAssignments,
    busyPlayers: nextBusyPlayers,
    taskProgress: nextTaskProgress,
    playerStats: nextPlayerStats,
  };
};

const createAssignedPlayerStats = (
  playerAssignments: SpaceStoreSnapshot["playerAssignments"],
): SpaceStoreSnapshot["playerStats"] =>
  Object.fromEntries(
    Object.keys(playerAssignments).map((playerId) => [
      playerId,
      createDefaultPlayerStats(),
    ]),
  );

const reduceResetRuntimeState = (
  state: SpaceStoreSnapshot,
  phase: SpaceStoreSnapshot["matchPhase"],
  connectedPlayerIds: string[] | undefined,
) => {
  const baseState = connectedPlayerIds
    ? pruneConnectedState(state, connectedPlayerIds)
    : state;

  return {
    ...baseState,
    matchPhase: phase,
    money: {},
    totalMoneyPenalty: 0,
    busyPlayers: {},
    taskProgress: {},
    playerStats:
      phase === "playing"
        ? createAssignedPlayerStats(baseState.playerAssignments)
        : {},
    gameOver: false,
    lifecycleVersion: baseState.lifecycleVersion + 1,
  };
};

export const createInitialSpaceGameState = (): SpaceStoreSnapshot => ({
  matchPhase: "lobby",
  money: {},
  totalMoneyPenalty: 0,
  gameDurationMs: OFFICE_MATCH_DURATION_MS,
  playerAssignments: {},
  busyPlayers: {},
  taskProgress: {},
  playerStats: {},
  gameOver: false,
  lifecycleVersion: 0,
});

export const reduceSyncConnectedPlayers = (
  state: SpaceStoreSnapshot,
  connectedPlayerIds: string[] | undefined,
) => pruneConnectedState(state, connectedPlayerIds);

export const reduceStartMatch = (
  state: SpaceStoreSnapshot,
  connectedPlayerIds: string[] | undefined,
) => reduceResetRuntimeState(state, "playing", connectedPlayerIds);

export const reduceRestartMatch = (
  state: SpaceStoreSnapshot,
  connectedPlayerIds: string[] | undefined,
) => reduceResetRuntimeState(state, "playing", connectedPlayerIds);

export const reduceReturnToLobby = (
  state: SpaceStoreSnapshot,
  connectedPlayerIds: string[] | undefined,
) => reduceResetRuntimeState(state, "lobby", connectedPlayerIds);

export const reduceFinishMatch = (state: SpaceStoreSnapshot) => {
  if (state.matchPhase !== "playing") {
    return state;
  }

  return {
    matchPhase: "ended" as const,
    busyPlayers: {},
    taskProgress: {},
    gameOver: true,
  };
};

export const reduceSelectCharacter = (
  state: SpaceStoreSnapshot,
  actorId: string | undefined,
  connectedPlayerIds: string[] | undefined,
  playerId: string,
) => {
  if (!actorId || !getPlayerById(playerId)) {
    return state;
  }

  const prunedState = pruneConnectedState(state, connectedPlayerIds);

  if (prunedState.playerAssignments[actorId] === playerId) {
    return prunedState;
  }

  const selectedByOtherController = Object.entries(
    prunedState.playerAssignments,
  ).some(
    ([controllerId, selectedPlayerId]) =>
      controllerId !== actorId && selectedPlayerId === playerId,
  );
  if (selectedByOtherController) {
    return prunedState;
  }

  return {
    playerAssignments: {
      ...prunedState.playerAssignments,
      [actorId]: playerId,
    },
  };
};
