import { useEffect, useMemo, useRef } from "react";
import { create, type StateCreator } from "zustand";
import { useAirJamContext, useAirJamState } from "../context/air-jam-context";
import { emitAirJamDiagnostic } from "../diagnostics";
import type {
  AirJamActionActorRole,
  AirJamActionPayload,
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
} from "../protocol";
import {
  getControllerRealtimeClient,
} from "../runtime/controller-realtime-client";
import { getHostRealtimeClient } from "../runtime/host-realtime-client";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import { isRpcSerializable } from "../utils/is-rpc-serializable";
import { resolveImplicitReplicatedStoreDomainFromWindow } from "../runtime/arcade-runtime-url";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
} from "./air-jam-store-domain-constants";

const INTERNAL_ACTION_PREFIX = "_";
const UNRESOLVED_ACTOR_ID = "unknown";

export interface CreateAirJamStoreOptions {
  storeDomain?: string;
}

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

const isPlainActionPayload = (
  payload: unknown,
): payload is AirJamActionPayload => {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(payload);
  return prototype === Object.prototype || prototype === null;
};

export interface AirJamActionContext {
  actorId: string;
  role: AirJamActionActorRole;
  connectedPlayerIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AirJamActionHandler = (ctx: AirJamActionContext, payload: any) => unknown;
type AirJamActionMap = Record<string, AirJamActionHandler>;

type IsValidActionPayloadType<TPayload> =
  [TPayload] extends [undefined]
    ? true
    : TPayload extends readonly unknown[]
      ? false
      : TPayload extends object
        ? true
        : false;

type InvalidActionPayloadKeys<TActions extends AirJamActionMap> = {
  [K in keyof TActions]:
    TActions[K] extends (
      ctx: AirJamActionContext,
      payload: infer TPayload,
    ) => unknown
      ? IsValidActionPayloadType<TPayload> extends true
        ? never
        : K
      : K;
}[keyof TActions];

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
      : TPayload extends readonly unknown[]
        ? never
        : TPayload extends object
        ? (payload: TPayload) => TResult
        : never
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
 *
 * `storeDomain` isolates sync and action RPC so multiple replicated stores can coexist in one room
 * (e.g. arcade shell vs running game). When omitted, resolves from the runtime URL: explicit
 * `aj_store_domain`, else embedded Arcade identity (`aj_arcade_*`), else the default domain.
 */
export function createAirJamStore<
  T extends AirJamNetworkedState,
>(
  initializer: InvalidActionPayloadKeys<T["actions"]> extends never
    ? StateCreator<T>
    : never,
  options?: CreateAirJamStoreOptions,
): AirJamSyncedStoreHook<T> {
  const store = create<T>((set, get, api) => initializer(set, get, api));

  const useSyncedStore = <U>(
    selector: (state: T) => U = (state) => state as unknown as U,
  ): U => {
    const slice = store(selector);

    const explicitDomain = options?.storeDomain;
    let resolvedStoreDomain: string;
    if (typeof explicitDomain === "string" && explicitDomain.trim().length > 0) {
      const trimmed = explicitDomain.trim();
      resolvedStoreDomain =
        trimmed.length > 128 ? trimmed.slice(0, 128) : trimmed;
    } else {
      resolvedStoreDomain = resolveImplicitReplicatedStoreDomainFromWindow();
    }

    const { getSocket } = useAirJamContext();
    const role = useAirJamState((state) => state.role);
    const roomId = useAirJamState((state) => state.roomId);
    const registeredRoomId = useAirJamState((state) => state.registeredRoomId);
    const players = useAirJamState((state) => state.players);
    const hostArcadeRestore = useAirJamState(
      (state) => state.hostArcadeRestore,
    );
    const blockArcadeShellHostBroadcast =
      resolvedStoreDomain === AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN &&
      hostArcadeRestore.phase !== "idle";
    const canBroadcastHostState =
      role === "host" &&
      !!roomId &&
      registeredRoomId === roomId &&
      !blockArcadeShellHostBroadcast;
    const connectedPlayerIds = useMemo(
      () => Array.from(new Set(players.map((player) => player.id))).sort(),
      [players],
    );
    const playerRosterKey = useMemo(
      () => players.map((player) => player.id).sort().join(","),
      [players],
    );
    const socket: AirJamRealtimeClient =
      role === "host"
        ? getHostRealtimeClient((runtimeRole) => getSocket(runtimeRole))
        : getControllerRealtimeClient((runtimeRole) => getSocket(runtimeRole));

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
        const flushHostStateSync = (): void => {
          if (!canBroadcastHostState) {
            return;
          }
          const stateData = stripActionsFromState(store.getState());
          socket.emit("host:state_sync", {
            roomId,
            data: stateData,
            storeDomain: resolvedStoreDomain,
          });
        };

        const unsubscribe = store.subscribe((newState) => {
          if (!canBroadcastHostState) {
            return;
          }
          const { actions, ...stateData } = newState;
          socket.emit("host:state_sync", {
            roomId,
            data: stateData,
            storeDomain: resolvedStoreDomain,
          });
        });

        const handleAction = (payload: AirJamActionRpcPayload) => {
          if (payload.storeDomain !== resolvedStoreDomain) {
            return;
          }
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

        socket.on("server:controllerJoined", flushHostStateSync);
        socket.on("airjam:action_rpc", handleAction);

        return () => {
          unsubscribe();
          socket.off("server:controllerJoined", flushHostStateSync);
          socket.off("airjam:action_rpc", handleAction);
        };
      }

      if (role === "controller") {
        const handleSync = (payload: AirJamStateSyncPayload) => {
          if (payload.storeDomain !== resolvedStoreDomain) {
            return;
          }
          const stateData = stripActionsFromState(payload.data as Partial<T>);
          store.setState(stateData);
        };

        socket.on("airjam:state_sync", handleSync);

        return () => {
          socket.off("airjam:state_sync", handleSync);
        };
      }
    }, [
      socket,
      role,
      roomId,
      registeredRoomId,
      socket?.id,
      resolvedStoreDomain,
      canBroadcastHostState,
    ]);

    useEffect(() => {
      if (!canBroadcastHostState || !socket || !roomId) {
        return;
      }
      const stateData = stripActionsFromState(store.getState());
      socket.emit("host:state_sync", {
        roomId,
        data: stateData,
        storeDomain: resolvedStoreDomain,
      });
    }, [
      role,
      socket,
      roomId,
      registeredRoomId,
      socket?.id,
      playerRosterKey,
      resolvedStoreDomain,
      canBroadcastHostState,
    ]);

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

          if (
            normalizedPayload !== undefined &&
            !isPlainActionPayload(normalizedPayload)
          ) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_ACTION_PAYLOAD_INVALID_SHAPE",
              severity: "warn",
              message: `[AirJamStore] Action "${actionName}" blocked: payload must be omitted or a plain object.`,
              details: { actionName },
            });
            return;
          }

          activeSocket.emit("controller:action_rpc", {
            roomId,
            actionName,
            payload: normalizedPayload,
            storeDomain: resolvedStoreDomain,
          });
        };
      }

      return actionDispatch;
    }, [role, roomId, resolvedStoreDomain]);

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
