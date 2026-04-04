import {
  createAirJamStore,
} from "@air-jam/sdk";
import {
  createInitialPongState,
  reduceJoinTeam,
  reduceRestartMatch,
  reduceReturnToLobby,
  reduceScorePoint,
  reduceSetBotCount,
  reduceSetPointsToWin,
  reduceStartMatch,
} from "./pong-store-state";
import type { PongState } from "./pong-store-types";

// This store is automatically synced between the host and all controllers.
export const usePongStore = createAirJamStore<PongState>((set) => ({
  ...createInitialPongState(),

  actions: {
    joinTeam: ({ actorId, connectedPlayerIds }, { team }) => {
      set((state) => {
        return reduceJoinTeam(state, {
          actorId,
          connectedPlayerIds,
          team,
        });
      });
    },

    setPointsToWin: (_ctx, { pointsToWin }) =>
      set((state) => reduceSetPointsToWin(state, pointsToWin)),

    setBotCount: ({ connectedPlayerIds }, { team, count }) =>
      set((state) =>
        reduceSetBotCount(state, {
          connectedPlayerIds,
          team,
          count,
        }),
      ),

    startMatch: ({ connectedPlayerIds }) =>
      set((state) => reduceStartMatch(state, connectedPlayerIds)),

    restartMatch: () =>
      set((state) => reduceRestartMatch(state)),

    returnToLobby: () =>
      set((state) => reduceReturnToLobby(state)),

    scorePoint: (_ctx, { team }) =>
      set((state) => reduceScorePoint(state, team)),
  },
}));
