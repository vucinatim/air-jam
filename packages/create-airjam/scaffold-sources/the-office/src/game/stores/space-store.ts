import { createAirJamStore, type AirJamActionContext } from "@air-jam/sdk";
import {
  clearPlayerTaskState,
  createDefaultPlayerStats,
  markPlayerDead,
  restorePlayerStat,
} from "./space-store-helpers";
import {
  createInitialSpaceGameState,
  reduceFinishMatch,
  reduceRestartMatch,
  reduceReturnToLobby,
  reduceSelectCharacter,
  reduceStartMatch,
  reduceSyncConnectedPlayers,
} from "./space-store-state";
import type { SpaceGameState } from "./types";

const hostOnly = (role: AirJamActionContext["role"]): boolean =>
  role === "host";

export const useSpaceStore = createAirJamStore<SpaceGameState>((set) => ({
  ...createInitialSpaceGameState(),

  actions: {
    syncConnectedPlayers: ({ role }, { connectedPlayerIds }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return reduceSyncConnectedPlayers(state, connectedPlayerIds);
      }),

    startMatch: ({ connectedPlayerIds }) =>
      set((state) => reduceStartMatch(state, connectedPlayerIds)),

    restartMatch: ({ connectedPlayerIds }) =>
      set((state) => reduceRestartMatch(state, connectedPlayerIds)),

    returnToLobby: ({ connectedPlayerIds }) =>
      set((state) => reduceReturnToLobby(state, connectedPlayerIds)),

    finishMatch: ({ role }) =>
      set((state) => {
        if (!hostOnly(role)) {
          return state;
        }

        return reduceFinishMatch(state);
      }),

    selectCharacter: ({ actorId, connectedPlayerIds }, { playerId }) =>
      set((state) => {
        return reduceSelectCharacter(
          state,
          actorId,
          connectedPlayerIds,
          playerId,
        );
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
  },
}));
