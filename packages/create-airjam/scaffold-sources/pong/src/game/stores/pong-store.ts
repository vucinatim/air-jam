/**
 * Networked pong store.
 *
 * This is the "state lane" — replicated, host-authoritative game state shared
 * between the host and every controller. Action handlers run on the host.
 * When a controller calls `actions.joinTeam(...)`, the SDK RPCs it to the
 * host, runs the reducer there, and broadcasts the updated state back to all
 * controllers.
 *
 * The reducers themselves are pure functions in `./pong-store-state` so they
 * can be unit-tested without a running session.
 */
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
