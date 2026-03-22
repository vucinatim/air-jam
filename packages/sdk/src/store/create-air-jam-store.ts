import { useEffect, useMemo, useRef } from "react";
import { create, type StateCreator } from "zustand";
import { useAirJamContext, useAirJamState } from "../context/air-jam-context";
import { emitAirJamDiagnostic } from "../diagnostics";
import type {
  AirJamActionActorRole,
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
} from "../protocol";
import { isRpcSerializable } from "../utils/is-rpc-serializable";

const INTERNAL_ACTION_PREFIX = "_";
const UNRESOLVED_ACTOR_ID = "unknown";

const isEventLikePayload = (payload: unknown): boolean => {
  if (payload === null || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.preventDefault === "function" ||
    typeof candidate.stopPropagation === "function" ||
    typeof candidate.persist === "function" ||
    ("nativeEvent" in candidate &&
      ("target" in candidate || "currentTarget" in candidate))
  );
};

export interface AirJamActionContext {
  actorId: string;
  role: AirJamActionActorRole;
  connectedPlayerIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AirJamActionHandler = (ctx: AirJamActionContext, payload: any) => unknown;
type AirJamActionMap = Record<string, AirJamActionHandler>;

type AirJamNetworkedState<TActions extends AirJamActionMap = AirJamActionMap> = {
  actions: TActions;
};

type AirJamActionDispatchMap<TActions extends AirJamActionMap> = {
  [K in keyof TActions]: TActions[K] extends (
    ctx: AirJamActionContext,
    payload: infer TPayload,
  ) => infer TResult
    ? [TPayload] extends [undefined]
      ? () => TResult
      : (payload: TPayload) => TResult
    : never;
};

export type AirJamSyncedStoreHook<T extends AirJamNetworkedState> = {
  <U>(selector?: (state: T) => U): U;
  useActions: () => AirJamActionDispatchMap<T["actions"]>;
};

export const isInternalActionName = (actionName: string): boolean =>
  actionName.startsWith(INTERNAL_ACTION_PREFIX);

const stripActionsFromState = <T extends AirJamNetworkedState>(
  data: Partial<T>,
): Partial<T> => {
  const { actions: _ignored, ...stateData } = data as Partial<T> & {
    actions?: unknown;
  };
  return stateData as Partial<T>;
};

const toActionContext = (
  payload: AirJamActionRpcPayload,
  connectedPlayerIds: string[],
): AirJamActionContext => ({
  actorId: payload.actor.id || UNRESOLVED_ACTOR_ID,
  role: payload.actor.role,
  connectedPlayerIds,
});

/**
 * Creates a networked Zustand store that syncs state from host to controllers.
 *
 * Host is the source of truth:
 * - Host broadcasts state updates to all controllers.
 * - Controllers invoke actions through RPC to host.
 */
export function createAirJamStore<
  T extends AirJamNetworkedState,
>(initializer: StateCreator<T>): AirJamSyncedStoreHook<T> {
  const store = create<T>((set, get, api) => initializer(set, get, api));

  // Track whether game UI is unloaded to block stale controller actions.
  const gameUiUnloadedRef = { current: false };

  const useSyncedStore = <U>(
    selector: (state: T) => U = (state) => state as unknown as U,
  ): U => {
    const slice = store(selector);

    const { getSocket } = useAirJamContext();
    const role = useAirJamState((state) => state.role);
    const roomId = useAirJamState((state) => state.roomId);
    const players = useAirJamState((state) => state.players);
    const connectedPlayerIds = useMemo(
      () => Array.from(new Set(players.map((player) => player.id))).sort(),
      [players],
    );
    const socket =
      role === "host" ? getSocket("host") : getSocket("controller");

    const socketRef = useRef(socket);
    useEffect(() => {
      socketRef.current = socket;
    }, [socket]);
    const connectedPlayerIdsRef = useRef(connectedPlayerIds);
    useEffect(() => {
      connectedPlayerIdsRef.current = connectedPlayerIds;
    }, [connectedPlayerIds]);

    useEffect(() => {
      if (!socket || !roomId || !role) {
        return;
      }

      if (role === "host") {
        const unsubscribe = store.subscribe((newState) => {
          const { actions, ...stateData } = newState;
          socket.emit("host:state_sync", { roomId, data: stateData });
        });

        const handleAction = (payload: AirJamActionRpcPayload) => {
          const { actionName } = payload;
          if (isInternalActionName(actionName)) {
            return;
          }

          const actionFn = store.getState().actions[actionName];
          if (typeof actionFn === "function") {
            actionFn(
              toActionContext(payload, connectedPlayerIdsRef.current),
              payload.payload,
            );
          }
        };

        socket.on("airjam:action_rpc", handleAction);

        return () => {
          unsubscribe();
          socket.off("airjam:action_rpc", handleAction);
        };
      }

      if (role === "controller") {
        gameUiUnloadedRef.current = false;

        const handleSync = (payload: AirJamStateSyncPayload) => {
          const stateData = stripActionsFromState(payload.data as Partial<T>);
          store.setState(stateData);
        };

        const handleUnloadUi = () => {
          gameUiUnloadedRef.current = true;
          socket.off("airjam:state_sync", handleSync);
        };

        const handleLoadUi = () => {
          gameUiUnloadedRef.current = false;
        };

        const handleDisconnect = () => {
          gameUiUnloadedRef.current = true;
        };

        socket.on("airjam:state_sync", handleSync);
        socket.on("client:loadUi", handleLoadUi);
        socket.on("client:unloadUi", handleUnloadUi);
        socket.on("disconnect", handleDisconnect);

        return () => {
          socket.off("airjam:state_sync", handleSync);
          socket.off("client:loadUi", handleLoadUi);
          socket.off("client:unloadUi", handleUnloadUi);
          socket.off("disconnect", handleDisconnect);
        };
      }
    }, [socket, role, roomId, socket?.id]);

    const dispatchedActions = useMemo<AirJamActionDispatchMap<T["actions"]>>(() => {
      const sourceActions = store.getState().actions;
      const actionDispatch = {} as AirJamActionDispatchMap<T["actions"]>;

      for (const actionName of Object.keys(sourceActions)) {
        if (isInternalActionName(actionName)) {
          continue;
        }

        const sourceAction = sourceActions[actionName];

        (
          actionDispatch as unknown as Record<string, (payload: unknown) => void>
        )[actionName] = (payload: unknown): void => {
          const normalizedPayload = isEventLikePayload(payload)
            ? undefined
            : payload;

          if (normalizedPayload !== payload) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_ACTION_EVENT_PAYLOAD_DROPPED",
              severity: "warn",
              message: `[AirJamStore] Action "${actionName}" received an event-like payload. Dropping payload and continuing.`,
              details: { actionName },
            });
          }

          if (role === "host") {
            sourceAction(
              {
                actorId: "host",
                role: "host",
                connectedPlayerIds: connectedPlayerIdsRef.current,
              },
              normalizedPayload,
            );
            return;
          }

          if (role !== "controller" || !roomId) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_ACTION_SESSION_NOT_READY",
              severity: "warn",
              message: `[AirJamStore] Action "${actionName}" blocked: session role not ready.`,
              details: { actionName, role, roomId },
            });
            return;
          }

          if (gameUiUnloadedRef.current) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_ACTION_UI_UNLOADED",
              severity: "warn",
              message: `[AirJamStore] Action "${actionName}" blocked: Game UI unloaded.`,
              details: { actionName },
            });
            return;
          }

          const activeSocket = socketRef.current;
          if (!activeSocket || !activeSocket.connected) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_ACTION_SOCKET_DISCONNECTED",
              severity: "warn",
              message: `[AirJamStore] Action "${actionName}" blocked: Socket disconnected.`,
              details: { actionName },
            });
            return;
          }

          if (!isRpcSerializable(normalizedPayload)) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE",
              severity: "warn",
              message: `[AirJamStore] Action "${actionName}" blocked: payload must be RPC-serializable.`,
              details: { actionName },
            });
            return;
          }

          activeSocket.emit("controller:action_rpc", {
            roomId,
            actionName,
            payload: normalizedPayload,
          });
        };
      }

      return actionDispatch;
    }, [role, roomId]);

    const stateActions = store.getState().actions;

    if (slice === stateActions) {
      return dispatchedActions as U;
    }

    if (
      typeof slice === "object" &&
      slice !== null &&
      "actions" in slice &&
      (slice as { actions: unknown }).actions === stateActions
    ) {
      return {
        ...(slice as Record<string, unknown>),
        actions: dispatchedActions,
      } as U;
    }

    return slice;
  };

  const syncedStore = useSyncedStore as AirJamSyncedStoreHook<T>;
  const useActions = (): AirJamActionDispatchMap<T["actions"]> =>
    useSyncedStore((state) => state.actions) as AirJamActionDispatchMap<T["actions"]>;
  syncedStore.useActions = useActions;

  return syncedStore;
}
