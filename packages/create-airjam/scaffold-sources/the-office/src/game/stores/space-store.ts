import {
  createAirJamStore,
  type AirJamActionContext,
} from "@air-jam/sdk";
import type { SpaceGameState } from "./types";
import {
  clearPlayerTaskState,
  createDefaultPlayerStats,
  markPlayerDead,
  pruneRecord,
  restorePlayerStat,
} from "./space-store-helpers";
import { getPlayerById } from "../../players";

const hostOnly = (
  role: AirJamActionContext["role"],
): boolean => role === "host";

export const useSpaceStore = createAirJamStore<SpaceGameState>((set) => ({
  matchPhase: "lobby",
  money: {},
  totalMoneyPenalty: 0,
  gameStartTime: 0,
  gameDurationMs: 300000,
  readyByPlayerId: {},
  playerPositions: {},
  playerAssignments: {},
  busyPlayers: {},
  taskProgress: {},
  playerStats: {},
  gameOver: false,

  actions: {
    syncConnectedPlayers: ({ role }, { connectedPlayerIds }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        const connectedSet = new Set(connectedPlayerIds);
        const nextMoney = pruneRecord(state.money, connectedSet);
        const nextPlayerPositions = pruneRecord(state.playerPositions, connectedSet);
        const nextPlayerAssignments = pruneRecord(
          state.playerAssignments,
          connectedSet,
        );
        const nextBusyPlayers = pruneRecord(state.busyPlayers, connectedSet);
        const nextTaskProgress = pruneRecord(state.taskProgress, connectedSet);
        const nextPlayerStats = pruneRecord(state.playerStats, connectedSet);
        const nextReadyByPlayerId = pruneRecord(state.readyByPlayerId, connectedSet);

        if (
          nextMoney === state.money &&
          nextPlayerPositions === state.playerPositions &&
          nextPlayerAssignments === state.playerAssignments &&
          nextBusyPlayers === state.busyPlayers &&
          nextTaskProgress === state.taskProgress &&
          nextPlayerStats === state.playerStats &&
          nextReadyByPlayerId === state.readyByPlayerId
        ) {
          return state;
        }

        return {
          money: nextMoney,
          playerPositions: nextPlayerPositions,
          playerAssignments: nextPlayerAssignments,
          busyPlayers: nextBusyPlayers,
          taskProgress: nextTaskProgress,
          playerStats: nextPlayerStats,
          readyByPlayerId: nextReadyByPlayerId,
        };
      }),

    setReady: ({ actorId }, { ready }) =>
      set((state) => {
        if (!actorId) {
          return state;
        }

        if (ready && !state.playerAssignments[actorId]) {
          return state;
        }

        if ((state.readyByPlayerId[actorId] ?? false) === ready) {
          return state;
        }

        return {
          readyByPlayerId: {
            ...state.readyByPlayerId,
            [actorId]: ready,
          },
        };
      }),

    selectCharacter: ({ actorId }, { playerId }) =>
      set((state) => {
        if (!actorId) {
          return state;
        }

        if (!getPlayerById(playerId)) {
          return state;
        }

        if (state.playerAssignments[actorId] === playerId) {
          return state;
        }

        const selectedByOtherController = Object.entries(state.playerAssignments).some(
          ([controllerId, selectedPlayerId]) =>
            controllerId !== actorId && selectedPlayerId === playerId,
        );
        if (selectedByOtherController) {
          return state;
        }

        return {
          playerAssignments: {
            ...state.playerAssignments,
            [actorId]: playerId,
          },
          playerStats: {
            ...state.playerStats,
            [actorId]:
              state.playerStats[actorId] || createDefaultPlayerStats(),
          },
          readyByPlayerId: {
            ...state.readyByPlayerId,
            [actorId]: false,
          },
        };
      }),

    completeTask: ({ role }, { playerId, reward }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          money: {
            ...state.money,
            [playerId]: (state.money[playerId] || 0) + reward,
          },
        };
      }),

    applyPenalty: ({ role }, { amount }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          totalMoneyPenalty: state.totalMoneyPenalty + amount,
        };
      }),

    resetGame: ({ role }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          matchPhase: "lobby",
          money: {},
          totalMoneyPenalty: 0,
          gameStartTime: Date.now(),
          readyByPlayerId: {},
          playerPositions: {},
          playerAssignments: {},
          busyPlayers: {},
          taskProgress: {},
          playerStats: {},
          gameOver: false,
        };
      }),

    assignPlayer: ({ role }, { controllerId, playerId }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          playerAssignments: {
            ...state.playerAssignments,
            [controllerId]: playerId,
          },
          playerStats: {
            ...state.playerStats,
            [controllerId]:
              state.playerStats[controllerId] || createDefaultPlayerStats(),
          },
        };
      }),

    setBusy: ({ role }, { playerId, taskName }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          busyPlayers: taskName
            ? { ...state.busyPlayers, [playerId]: taskName }
            : clearPlayerTaskState(
                state.busyPlayers,
                state.taskProgress,
                playerId,
              ).busyPlayers,
          taskProgress: taskName
            ? state.taskProgress
            : clearPlayerTaskState(
                state.busyPlayers,
                state.taskProgress,
                playerId,
              ).taskProgress,
        };
      }),

    setTaskProgress: ({ role }, { playerId, progress }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          taskProgress: {
            ...state.taskProgress,
            [playerId]: progress,
          },
        };
      }),

    updatePlayerStats: ({ role }, { playerId, updates }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return {
          playerStats: {
            ...state.playerStats,
            [playerId]: {
              ...(state.playerStats[playerId] || createDefaultPlayerStats()),
              ...updates,
            },
          },
        };
      }),

    restoreEnergy: ({ role }, { playerId, amount }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        const currentStats =
          state.playerStats[playerId] || createDefaultPlayerStats();

        return {
          playerStats: {
            ...state.playerStats,
            [playerId]: restorePlayerStat(currentStats, "energy", amount),
          },
        };
      }),

    restoreBoredom: ({ role }, { playerId, amount }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        const currentStats =
          state.playerStats[playerId] || createDefaultPlayerStats();

        return {
          playerStats: {
            ...state.playerStats,
            [playerId]: restorePlayerStat(currentStats, "boredom", amount),
          },
        };
      }),

    killPlayer: ({ role }, { playerId }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        const currentStats =
          state.playerStats[playerId] || createDefaultPlayerStats();

        return {
          playerStats: {
            ...state.playerStats,
            [playerId]: markPlayerDead(currentStats),
          },
        };
      }),

    setGameOver: ({ role }, { gameOver }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return { gameOver };
      }),

    setGameStartTime: ({ role }, { startTime }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return { gameStartTime: startTime };
      }),

    setMatchPhase: ({ role }, { phase }) =>
      set((state) => {
        if (!hostOnly(role) || state.matchPhase === phase) {
          return state;
        }

        return { matchPhase: phase };
      }),
  },
}));
