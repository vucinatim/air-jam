import { useEffect } from "react";
import { create, type StateCreator } from "zustand";
import { useAirJamContext, useAirJamState } from "../context/air-jam-context";
import type {
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
} from "../protocol";

/**
 * Creates a networked Zustand store that automatically syncs state between host and controllers.
 *
 * The store pattern works as follows:
 * - Host: Stores state locally and broadcasts changes to all controllers
 * - Controller: Sends action RPCs to host, receives state updates from host
 *
 * @example
 * ```ts
 * interface GameState {
 *   phase: "lobby" | "playing" | "gameover";
 *   scores: { team1: number; team2: number };
 *   actions: {
 *     setPhase: (phase: "lobby" | "playing") => void;
 *     scorePoint: (team: "team1" | "team2") => void;
 *   };
 * }
 *
 * export const useGameStore = createAirJamStore<GameState>((set) => ({
 *   phase: "lobby",
 *   scores: { team1: 0, team2: 0 },
 *   actions: {
 *     setPhase: (phase) => set({ phase }),
 *     scorePoint: (team) => set((state) => ({
 *       scores: { ...state.scores, [team]: state.scores[team] + 1 }
 *     })),
 *   },
 * }));
 * ```
 */
export function createAirJamStore<
  T extends {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: Record<string, (...args: any[]) => any>;
  },
>(initializer: StateCreator<T>) {
  // 1. Create the Vanilla Zustand Store with an internal sync action
  const store = create<T>((set, get, api) => {
    const baseState = initializer(set, get, api);
    // Add internal _syncState action for external updates
    return {
      ...baseState,
      actions: {
        ...baseState.actions,
        _syncState: (partial: Partial<T>) => {
          set(partial as T);
        },
      },
    } as T;
  });

  // 2. The Hook Component
  const useSyncedStore = <U>(
    selector: (state: T) => U = (s) => s as unknown as U,
  ): U => {
    // Standard Zustand selector behavior
    const slice = store(selector);

    const { getSocket } = useAirJamContext();
    const role = useAirJamState((state) => state.role);
    const roomId = useAirJamState((state) => state.roomId);
    const controllerId = useAirJamState((state) => state.controllerId);
    const socket =
      role === "host" ? getSocket("host") : getSocket("controller");

    // --- NETWORKING LOGIC ---
    useEffect(() => {
      if (!socket || !roomId || !role) {
        return;
      }

      // HOST: Broadcast changes to everyone
      if (role === "host") {
        // Subscribe to store changes
        const unsubscribe = store.subscribe((newState) => {
          // Optimization: Don't broadcast 'actions' function
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { actions, ...stateData } = newState;
          socket.emit("host:state_sync", { roomId, data: stateData });
        });

        // Listen for Action Requests (RPCs) from controllers
        const handleAction = (payload: AirJamActionRpcPayload) => {
          const { actionName, args, controllerId } = payload;
          // Execute the action on the Host (Source of Truth)
          // We can optionally pass controllerId as the last arg if the action expects it
          const actionFn = store.getState().actions[actionName];
          if (actionFn) {
            // Spread args and optionally append controllerId
            actionFn(...args, controllerId);
          }
        };

        socket.on("airjam:action_rpc", handleAction);

        return () => {
          unsubscribe();
          socket.off("airjam:action_rpc", handleAction);
        };
      }

      // CONTROLLER: Listen for state updates
      if (role === "controller") {
        const handleSync = (payload: AirJamStateSyncPayload) => {
          const { data } = payload;
          // Merge incoming state, but KEEP the local actions
          // Use the internal _syncState action to update state (triggers Zustand subscriptions)
          const currentState = store.getState();
          const actions = currentState.actions as T["actions"] & {
            _syncState?: (partial: Partial<T>) => void;
          };

          // Update store using internal action - this triggers Zustand subscriptions properly
          if (actions._syncState) {
            actions._syncState(data as Partial<T>);
          } else {
            // Fallback to setState if _syncState not available
            store.setState(data as Partial<T>);
          }
        };

        socket.on("airjam:state_sync", handleSync);
        return () => socket.off("airjam:state_sync", handleSync);
      }
    }, [socket, role, roomId]);

    // --- PROXY ACTIONS (The Magic) ---
    // On the Controller, we replace actions with Network Calls
    if (role === "controller" && socket && roomId) {
      // We need to return a modified slice where the actions are proxied
      // This handles two cases:
      // 1. Selector returns full state: { actions: {...}, ... }
      // 2. Selector returns just actions: { joinTeam: fn, ... }

      let originalActions: T["actions"] | null = null;

      // Case 1: Slice has "actions" property (full state)
      if (typeof slice === "object" && slice !== null && "actions" in slice) {
        originalActions = (slice as { actions: T["actions"] }).actions;
      }
      // Case 2: Slice IS the actions object (selector returned state.actions)
      else if (typeof slice === "object" && slice !== null) {
        // Check if this looks like an actions object (has function properties matching store actions)
        const fullState = store.getState();
        if (fullState.actions) {
          const sliceKeys = Object.keys(slice);
          const actionKeys = Object.keys(fullState.actions);
          // If slice keys match action keys and are all functions, it's the actions object
          if (
            sliceKeys.length > 0 &&
            sliceKeys.every(
              (key) =>
                typeof (slice as Record<string, unknown>)[key] === "function" &&
                actionKeys.includes(key),
            )
          ) {
            originalActions = slice as T["actions"];
          }
        }
      }

      if (originalActions) {
        // Use the same type as T["actions"] for proxy actions
        const proxyActions = {} as T["actions"];

        Object.keys(originalActions).forEach((key) => {
          // Type assertion needed because we're creating proxies dynamically
          // We cast to the same type as T["actions"] to maintain type compatibility
          (proxyActions as Record<string, (...args: unknown[]) => void>)[key] =
            (...args: unknown[]) => {
              // 1. Optimistic Update (Optional, disabled for safety by default)
              // originalActions[key](...args);

              // 2. Send RPC to Host (include controllerId to handle reconnections)
              if (!controllerId) {
                console.warn(
                  "[AirJamStore] Cannot send action RPC: controllerId not set",
                );
                return;
              }
              socket.emit("controller:action_rpc", {
                roomId,
                actionName: key,
                args,
                controllerId,
              });
            };
        });

        // Return proxied actions - if slice was the actions object, return proxyActions directly
        // Otherwise, return slice with actions replaced
        if (typeof slice === "object" && slice !== null && "actions" in slice) {
          return { ...slice, actions: proxyActions } as U;
        } else {
          return proxyActions as U;
        }
      }
    }

    return slice;
  };

  return useSyncedStore;
}
