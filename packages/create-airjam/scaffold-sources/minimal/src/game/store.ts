/**
 * Networked game store. The "state lane".
 *
 * Replicated, host-authoritative state shared between the host and every
 * controller. Action handlers run on the host — when a controller calls
 * `actions.tap()`, the SDK RPCs it to the host, runs the reducer there, and
 * broadcasts the updated state back to every controller.
 *
 * The `ctx` argument injected into each action carries `actorId` (the
 * controller that initiated the action), `role` ("host" / "controller"), and
 * the current `connectedPlayerIds`. Treat it as the trustworthy identity of
 * the caller — never use fields from the payload for auth-adjacent logic.
 *
 * The reducers live here as pure functions (no SDK imports, no React) so
 * they can be unit-tested without a running session.
 */
import {
  createAirJamStore,
  type AirJamActionContext,
} from "@air-jam/sdk";

export interface MinimalState {
  /** Shared running total of taps across all connected controllers. */
  totalCount: number;
  /** Per-controller tap counts, keyed by `actorId` (controllerId). */
  perPlayerCounts: Record<string, number>;

  actions: {
    tap: (ctx: AirJamActionContext, payload: undefined) => void;
    reset: (ctx: AirJamActionContext, payload: undefined) => void;
  };
}

export type MinimalStateData = Omit<MinimalState, "actions">;

export const createInitialMinimalState = (): MinimalStateData => ({
  totalCount: 0,
  perPlayerCounts: {},
});

/** Increment the total + the initiating player's count. */
export const reduceTap = (
  state: MinimalStateData,
  actorId: string | undefined,
): MinimalStateData => {
  if (!actorId) return state;
  return {
    totalCount: state.totalCount + 1,
    perPlayerCounts: {
      ...state.perPlayerCounts,
      [actorId]: (state.perPlayerCounts[actorId] ?? 0) + 1,
    },
  };
};

/** Clear all counts back to zero. */
export const reduceReset = (): MinimalStateData =>
  createInitialMinimalState();

export const useMinimalStore = createAirJamStore<MinimalState>((set) => ({
  ...createInitialMinimalState(),

  actions: {
    tap: ({ actorId }) => {
      set((state) => reduceTap(state, actorId));
    },
    reset: () => {
      set(() => reduceReset());
    },
  },
}));
