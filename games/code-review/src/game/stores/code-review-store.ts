import { createAirJamStore } from "@air-jam/sdk";
import {
  createInitialCodeReviewState,
  reduceFinishMatch,
  reduceJoinTeam,
  reduceResetGame,
  reduceResetToLobby,
  reduceScorePoint,
  reduceSetBotCount,
  reduceStartMatch,
  reduceSyncConnectedPlayers,
} from "./code-review-store-state";
import type { CodeReviewGameState } from "./code-review-store-types";

export const useGameStore = createAirJamStore<CodeReviewGameState>((set) => ({
  ...createInitialCodeReviewState(),

  actions: {
    startMatch: () => set((state) => reduceStartMatch(state)),

    resetToLobby: () => set((state) => reduceResetToLobby(state)),

    finishMatch: ({ role }) =>
      set((state) => {
        if (role !== "host" || state.matchPhase !== "playing") {
          return state;
        }

        return reduceFinishMatch(state);
      }),

    syncConnectedPlayers: ({ role }, { connectedPlayerIds }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        return reduceSyncConnectedPlayers(state, connectedPlayerIds);
      }),

    joinTeam: ({ actorId, connectedPlayerIds }, { team }) =>
      set((state) => reduceJoinTeam(state, actorId, connectedPlayerIds, team)),

    setBotCount: ({ connectedPlayerIds }, { team, count }) =>
      set((state) => reduceSetBotCount(state, connectedPlayerIds, team, count)),

    resetGame: ({ role }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        return reduceResetGame();
      }),

    scorePoint: ({ role }, { team }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        return reduceScorePoint(state, team);
      }),
  },
}));
