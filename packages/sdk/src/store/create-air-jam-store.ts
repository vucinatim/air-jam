import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { create, type StateCreator } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { useAirJamContext, useAirJamState } from "../context/air-jam-context";
import { emitAirJamDiagnostic } from "../diagnostics";
import type {
  AirJamActionActorRole,
  AirJamActionInvocationResult,
  AirJamActionPayload,
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
} from "../protocol";
import { resolveImplicitReplicatedStoreDomainFromWindow } from "../runtime/arcade-runtime-url";
import { getControllerRealtimeClient } from "../runtime/controller-realtime-client";
import { getHostRealtimeClient } from "../runtime/host-realtime-client";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import { isRpcSerializable } from "../utils/is-rpc-serializable";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  AIR_JAM_DEFAULT_STORE_DOMAIN,
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
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
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

export interface AirJamActionRejection {
  readonly __airJamActionRejection: true;
  reason: string;
  message: string;
  details?: AirJamActionPayload;
}

export interface AirJamActionAcceptance<TResult = unknown> {
  readonly __airJamActionAcceptance: true;
  result?: TResult;
}

type AirJamActionHandler = (
  ctx: AirJamActionContext,
  // Internal existential handler shape for heterogenous action maps.
  // Store authors still get precise payload types through inference at the public API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) => unknown;
type AirJamActionMap = Record<string, AirJamActionHandler>;
type AirJamActionName<TActions extends AirJamActionMap> = Extract<
  keyof TActions,
  string
>;

type IsValidActionPayloadType<TPayload> = [TPayload] extends [undefined]
  ? true
  : TPayload extends readonly unknown[]
    ? false
    : TPayload extends object
      ? true
      : false;

type InvalidActionPayloadKeys<TActions extends AirJamActionMap> = {
  [K in keyof TActions]: TActions[K] extends (
    ctx: AirJamActionContext,
    payload: infer TPayload,
  ) => unknown
    ? IsValidActionPayloadType<TPayload> extends true
      ? never
      : K
    : K;
}[keyof TActions];

type InvalidActionPayloadKeyNames<TActions extends AirJamActionMap> = Extract<
  InvalidActionPayloadKeys<TActions>,
  string
>;

type AirJamInvalidActionPayloadDiagnostic<TActions extends AirJamActionMap> = {
  readonly __airJamInvalidActionPayloads__: InvalidActionPayloadKeyNames<TActions>;
  readonly __airJamActionPayloadRule__: "Networked store action payloads must be omitted or one plain object payload. Unions like T | undefined, arrays, and primitives are not valid payload roots.";
};

type AirJamNetworkedState<TActions extends AirJamActionMap = AirJamActionMap> =
  {
    actions: TActions;
  };

type AirJamActionDispatchMap<TActions extends AirJamActionMap> = {
  [K in keyof TActions]: TActions[K] extends (
    ctx: AirJamActionContext,
    payload: infer TPayload,
  ) => infer TResult
    ? [TPayload] extends [undefined]
      ? () => Promise<
          AirJamActionInvocationResult<InferAirJamActionResult<TResult>>
        >
      : TPayload extends readonly unknown[]
        ? never
        : TPayload extends object
          ? (
              payload: TPayload,
            ) => Promise<
              AirJamActionInvocationResult<InferAirJamActionResult<TResult>>
            >
          : never
    : never;
};

type InferAirJamActionResult<TResult> =
  TResult extends AirJamActionAcceptance<infer TAccepted>
    ? TAccepted
    : TResult extends AirJamActionRejection
      ? never
      : TResult;

interface StoreRuntimeSnapshot {
  socket: AirJamRealtimeClient | null;
  role: AirJamActionActorRole | null;
  roomId: string | null;
  resolvedStoreDomain: string;
  connectionStatus: string | null;
  canBroadcastHostState: boolean;
  connectedPlayerIds: string[];
}

interface StoreRuntimeBinding {
  refCount: number;
  flushHostStateSync?: () => void;
  lastHostFlushKey?: string;
  cleanup: () => void;
}

export type AirJamHostActionEvent<
  TActions extends AirJamActionMap = AirJamActionMap,
  TActionName extends AirJamActionName<TActions> = AirJamActionName<TActions>,
> =
  TActionName extends AirJamActionName<TActions>
    ? TActions[TActionName] extends (
        ctx: AirJamActionContext,
        payload: infer TPayload,
      ) => infer TResult
      ? {
          actionName: TActionName;
          payload: TPayload;
          context: AirJamActionContext;
          acknowledgement: AirJamActionInvocationResult<
            InferAirJamActionResult<TResult>
          >;
          invocationKind: "local" | "rpc";
          roomId: string | null;
          storeDomain: string;
        }
      : never
    : never;

export interface AirJamHostActionSubscriptionOptions<
  TActions extends AirJamActionMap = AirJamActionMap,
> {
  actionNames?: readonly AirJamActionName<TActions>[];
  includeRejected?: boolean;
}

export type AirJamHostActionListener<
  TActions extends AirJamActionMap = AirJamActionMap,
> = (event: AirJamHostActionEvent<TActions>) => void;

interface HostActionListenerRegistration<TActions extends AirJamActionMap> {
  actionNames: ReadonlySet<string> | null;
  includeRejected: boolean;
  listener: AirJamHostActionListener<TActions>;
}

export type AirJamSyncedStoreHook<T extends AirJamNetworkedState> = {
  <U>(selector?: (state: T) => U): U;
  useActions: () => AirJamActionDispatchMap<T["actions"]>;
  asPlayer: (controllerId: string) => AirJamActionDispatchMap<T["actions"]>;
  getState: () => T;
  subscribe: StoreApi<T>["subscribe"];
  subscribeHostActions: (
    listener: AirJamHostActionListener<T["actions"]>,
    options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
  ) => () => void;
  useHostActionListener: (
    listener: AirJamHostActionListener<T["actions"]>,
    options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
  ) => void;
  useLiveStateRef: () => MutableRefObject<T>;
};

export const isInternalActionName = (actionName: string): boolean =>
  actionName.startsWith(INTERNAL_ACTION_PREFIX);

export const acceptAirJamAction = <TResult = unknown>(
  result?: TResult,
): AirJamActionAcceptance<TResult> => ({
  __airJamActionAcceptance: true,
  ...(result !== undefined ? { result } : {}),
});

export const rejectAirJamAction = (
  reason: string,
  message: string,
  details?: AirJamActionPayload,
): AirJamActionRejection => ({
  __airJamActionRejection: true,
  reason,
  message,
  ...(details ? { details } : {}),
});

const isAirJamActionAcceptance = (
  value: unknown,
): value is AirJamActionAcceptance<unknown> =>
  typeof value === "object" &&
  value !== null &&
  (value as { __airJamActionAcceptance?: boolean }).__airJamActionAcceptance ===
    true;

const isAirJamActionRejection = (
  value: unknown,
): value is AirJamActionRejection =>
  typeof value === "object" &&
  value !== null &&
  (value as { __airJamActionRejection?: boolean }).__airJamActionRejection ===
    true;

const createClientRejectedActionResult = (
  reason: string,
  message: string,
  details?: AirJamActionPayload,
): AirJamActionInvocationResult => ({
  ok: false,
  status: "rejected",
  source: "client",
  reason,
  message,
  ...(details ? { details } : {}),
});

const createServerRejectedActionResult = (
  reason: string,
  message: string,
  details?: AirJamActionPayload,
): AirJamActionInvocationResult => ({
  ok: false,
  status: "rejected",
  source: "server",
  reason,
  message,
  ...(details ? { details } : {}),
});

const normalizeAirJamActionInvocationResult = (
  value: unknown,
  source: "client" | "host",
): AirJamActionInvocationResult => {
  if (isAirJamActionRejection(value)) {
    return {
      ok: false,
      status: "rejected",
      source,
      reason: value.reason,
      message: value.message,
      ...(value.details ? { details: value.details } : {}),
    };
  }

  if (isAirJamActionAcceptance(value)) {
    return {
      ok: true,
      status: "accepted",
      source,
      ...(value.result !== undefined ? { result: value.result } : {}),
    };
  }

  return {
    ok: true,
    status: "accepted",
    source,
    ...(value !== undefined ? { result: value } : {}),
  };
};

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
export function createAirJamStore<T extends AirJamNetworkedState>(
  initializer: InvalidActionPayloadKeys<T["actions"]> extends never
    ? StateCreator<T>
    : StateCreator<T> & AirJamInvalidActionPayloadDiagnostic<T["actions"]>,
  options?: CreateAirJamStoreOptions,
): AirJamSyncedStoreHook<T> {
  const store = create<T>((set, get, api) => initializer(set, get, api));
  const runtimeSnapshotRef: { current: StoreRuntimeSnapshot } = {
    current: {
      socket: null,
      role: null,
      roomId: null,
      resolvedStoreDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      connectionStatus: null,
      canBroadcastHostState: false,
      connectedPlayerIds: [],
    },
  };
  const runtimeBindings = new Map<string, StoreRuntimeBinding>();
  const hostActionListeners = new Set<
    HostActionListenerRegistration<T["actions"]>
  >();

  const createDispatchedActions = (
    mode:
      | {
          kind: "default";
        }
      | {
          kind: "player";
          controllerId: string;
        },
  ): AirJamActionDispatchMap<T["actions"]> => {
    const sourceActions = store.getState().actions;
    const actionDispatch = {} as AirJamActionDispatchMap<T["actions"]>;

    for (const actionName of Object.keys(sourceActions)) {
      if (isInternalActionName(actionName)) {
        continue;
      }

      const sourceAction = sourceActions[actionName];

      (
        actionDispatch as unknown as Record<
          string,
          (payload: unknown) => Promise<AirJamActionInvocationResult>
        >
      )[actionName] = async (
        payload: unknown,
      ): Promise<AirJamActionInvocationResult> => {
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

        const runtime = runtimeSnapshotRef.current;

        if (mode.kind === "player" && runtime.role !== "host") {
          emitAirJamDiagnostic({
            code: "AJ_STORE_PLAYER_ACTIONS_HOST_ONLY",
            severity: "warn",
            message: `[AirJamStore] Player impersonation for action "${actionName}" is host-only.`,
            details: {
              actionName,
              role: runtime.role,
              controllerId: mode.controllerId,
            },
          });
          return createClientRejectedActionResult(
            "player_actions_host_only",
            `Store action "${actionName}" cannot impersonate a player outside the host runtime.`,
            {
              actionName,
              ...(runtime.role ? { role: runtime.role } : {}),
              controllerId: mode.controllerId,
            },
          );
        }

        if (mode.kind === "player") {
          const normalizedControllerId = mode.controllerId.trim();
          if (normalizedControllerId.length === 0) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_PLAYER_ACTIONS_INVALID_ACTOR_ID",
              severity: "warn",
              message: `[AirJamStore] Player impersonation for action "${actionName}" requires a non-empty controller id.`,
              details: {
                actionName,
              },
            });
            return createClientRejectedActionResult(
              "player_actor_id_invalid",
              `Store action "${actionName}" requires a non-empty controller id for player impersonation.`,
              {
                actionName,
              },
            );
          }

          if (!runtime.connectedPlayerIds.includes(normalizedControllerId)) {
            emitAirJamDiagnostic({
              code: "AJ_STORE_PLAYER_ACTIONS_PLAYER_NOT_CONNECTED",
              severity: "warn",
              message: `[AirJamStore] Player impersonation for action "${actionName}" requires a currently connected controller.`,
              details: {
                actionName,
                controllerId: normalizedControllerId,
                connectedPlayerIds: runtime.connectedPlayerIds,
              },
            });
            return createClientRejectedActionResult(
              "player_not_connected",
              `Store action "${actionName}" cannot impersonate controller "${normalizedControllerId}" because it is not currently connected.`,
              {
                actionName,
                controllerId: normalizedControllerId,
              },
            );
          }
        }

        if (runtime.role === "host") {
          try {
            const context =
              mode.kind === "player"
                ? ({
                    actorId: mode.controllerId.trim(),
                    role: "controller",
                    connectedPlayerIds: runtime.connectedPlayerIds,
                  } satisfies AirJamActionContext)
                : ({
                    actorId: "host",
                    role: "host",
                    connectedPlayerIds: runtime.connectedPlayerIds,
                  } satisfies AirJamActionContext);
            const result = sourceAction(context, normalizedPayload);
            const acknowledgement = normalizeAirJamActionInvocationResult(
              result,
              "host",
            );
            const typedActionName = actionName as AirJamActionName<
              T["actions"]
            >;
            notifyHostActionListeners({
              actionName: typedActionName,
              payload: normalizedPayload,
              context,
              acknowledgement,
              invocationKind: "local",
              roomId: runtime.roomId,
              storeDomain: runtime.resolvedStoreDomain,
            } as AirJamHostActionEvent<T["actions"], typeof typedActionName>);
            return acknowledgement;
          } catch (error) {
            const acknowledgement = {
              ok: false,
              status: "rejected",
              source: "host",
              reason: "handler_error",
              message: error instanceof Error ? error.message : String(error),
            } satisfies AirJamActionInvocationResult;
            const typedActionName = actionName as AirJamActionName<
              T["actions"]
            >;
            notifyHostActionListeners({
              actionName: typedActionName,
              payload: normalizedPayload,
              context: {
                actorId:
                  mode.kind === "player" ? mode.controllerId.trim() : "host",
                role: mode.kind === "player" ? "controller" : "host",
                connectedPlayerIds: runtime.connectedPlayerIds,
              },
              acknowledgement,
              invocationKind: "local",
              roomId: runtime.roomId,
              storeDomain: runtime.resolvedStoreDomain,
            } as AirJamHostActionEvent<T["actions"], typeof typedActionName>);
            return acknowledgement;
          }
        }

        if (runtime.role !== "controller" || !runtime.roomId) {
          emitAirJamDiagnostic({
            code: "AJ_STORE_ACTION_SESSION_NOT_READY",
            severity: "warn",
            message: `[AirJamStore] Action "${actionName}" blocked: session role not ready.`,
            details: {
              actionName,
              role: runtime.role,
              roomId: runtime.roomId,
            },
          });
          return createClientRejectedActionResult(
            "session_not_ready",
            `Store action "${actionName}" cannot run because the controller session is not ready.`,
            {
              actionName,
              ...(runtime.role ? { role: runtime.role } : {}),
              ...(runtime.roomId ? { roomId: runtime.roomId } : {}),
            },
          );
        }

        const activeSocket = runtime.socket;
        if (!activeSocket || !activeSocket.connected) {
          emitAirJamDiagnostic({
            code: "AJ_STORE_ACTION_SOCKET_DISCONNECTED",
            severity: "warn",
            message: `[AirJamStore] Action "${actionName}" blocked: Socket disconnected.`,
            details: { actionName },
          });
          return createClientRejectedActionResult(
            "socket_disconnected",
            `Store action "${actionName}" cannot run because the controller socket is disconnected.`,
            {
              actionName,
            },
          );
        }

        if (!isRpcSerializable(normalizedPayload)) {
          emitAirJamDiagnostic({
            code: "AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE",
            severity: "warn",
            message: `[AirJamStore] Action "${actionName}" blocked: payload must be RPC-serializable.`,
            details: { actionName },
          });
          return createClientRejectedActionResult(
            "payload_not_serializable",
            `Store action "${actionName}" requires an RPC-serializable payload.`,
            {
              actionName,
            },
          );
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
          return createClientRejectedActionResult(
            "payload_invalid_shape",
            `Store action "${actionName}" requires an omitted payload or a plain object payload.`,
            {
              actionName,
            },
          );
        }

        return await activeSocket.emitWithAck<AirJamActionInvocationResult>(
          "controller:action_rpc",
          {
            roomId: runtime.roomId,
            actionName,
            payload: normalizedPayload,
            storeDomain: runtime.resolvedStoreDomain,
          },
        );
      };
    }

    return actionDispatch;
  };

  const notifyHostActionListeners = <
    TActionName extends AirJamActionName<T["actions"]>,
  >(
    event: AirJamHostActionEvent<T["actions"], TActionName>,
  ): void => {
    for (const registration of hostActionListeners) {
      if (
        registration.actionNames &&
        !registration.actionNames.has(event.actionName)
      ) {
        continue;
      }

      if (
        !registration.includeRejected &&
        event.acknowledgement.status === "rejected"
      ) {
        continue;
      }

      try {
        registration.listener(event);
      } catch (error) {
        console.error(
          `[AirJamStore] Host action listener for "${event.actionName}" threw.`,
          error,
        );
      }
    }
  };

  const createRuntimeBinding = ({
    socket,
    role,
    roomId,
    resolvedStoreDomain,
  }: {
    socket: AirJamRealtimeClient;
    role: AirJamActionActorRole;
    roomId: string;
    resolvedStoreDomain: string;
  }): StoreRuntimeBinding => {
    if (role === "host") {
      let syncedStateData = stripActionsFromState(store.getState());
      let syncedStateSignature = JSON.stringify(syncedStateData);
      let syncRevision = 0;

      const emitHostStateSync = (requestId?: string): void => {
        const runtime = runtimeSnapshotRef.current;
        if (
          runtime.role !== "host" ||
          runtime.roomId !== roomId ||
          runtime.resolvedStoreDomain !== resolvedStoreDomain ||
          !runtime.canBroadcastHostState ||
          !runtime.socket
        ) {
          return;
        }

        runtime.socket.emit("host:state_sync", {
          roomId,
          data: syncedStateData,
          storeDomain: resolvedStoreDomain,
          revision: syncRevision,
          ...(requestId ? { requestId } : {}),
        });
      };

      const flushHostStateSync = (requestId?: string): void => {
        emitHostStateSync(requestId);
      };

      const handleControllerJoined = (): void => {
        flushHostStateSync();
      };

      const unsubscribe = store.subscribe((newState) => {
        const runtime = runtimeSnapshotRef.current;
        if (
          runtime.role !== "host" ||
          runtime.roomId !== roomId ||
          runtime.resolvedStoreDomain !== resolvedStoreDomain ||
          !runtime.canBroadcastHostState ||
          !runtime.socket
        ) {
          return;
        }

        const stateData = stripActionsFromState(newState);
        const nextSignature = JSON.stringify(stateData);
        if (nextSignature === syncedStateSignature) {
          return;
        }

        syncedStateData = stateData;
        syncedStateSignature = nextSignature;
        syncRevision += 1;
        emitHostStateSync();
      });

      const handleAction = (
        payload: AirJamActionRpcPayload,
        callback?: (ack: AirJamActionInvocationResult) => void,
      ) => {
        if (payload.storeDomain !== resolvedStoreDomain) {
          return;
        }
        const { actionName } = payload;
        if (isInternalActionName(actionName)) {
          return;
        }

        const runtime = runtimeSnapshotRef.current;
        const actionFn = store.getState().actions[actionName];
        if (typeof actionFn !== "function") {
          callback?.(
            createServerRejectedActionResult(
              "action_not_found",
              `Store action "${actionName}" is not registered on the host.`,
              {
                actionName,
                storeDomain: resolvedStoreDomain,
              },
            ),
          );
          return;
        }

        try {
          const context = toActionContext(payload, runtime.connectedPlayerIds);
          const result = actionFn(context, payload.payload);
          const acknowledgement = normalizeAirJamActionInvocationResult(
            result,
            "host",
          );
          const actionName = payload.actionName as AirJamActionName<
            T["actions"]
          >;
          notifyHostActionListeners({
            actionName,
            payload: payload.payload,
            context,
            acknowledgement,
            invocationKind: "rpc",
            roomId,
            storeDomain: resolvedStoreDomain,
          } as AirJamHostActionEvent<T["actions"], typeof actionName>);
          callback?.(acknowledgement);
        } catch (error) {
          const acknowledgement = {
            ok: false,
            status: "rejected",
            source: "host",
            reason: "handler_error",
            message: error instanceof Error ? error.message : String(error),
          } satisfies AirJamActionInvocationResult;
          const actionName = payload.actionName as AirJamActionName<
            T["actions"]
          >;
          notifyHostActionListeners({
            actionName,
            payload: payload.payload,
            context: toActionContext(payload, runtime.connectedPlayerIds),
            acknowledgement,
            invocationKind: "rpc",
            roomId,
            storeDomain: resolvedStoreDomain,
          } as AirJamHostActionEvent<T["actions"], typeof actionName>);
          callback?.(acknowledgement);
        }
      };

      const handleStateSyncRequest = (payload: {
        roomId: string;
        storeDomain: string;
        requestId?: string;
      }): void => {
        if (payload.roomId !== roomId) {
          return;
        }
        if (payload.storeDomain !== resolvedStoreDomain) {
          return;
        }
        flushHostStateSync(payload.requestId);
      };

      const handleSync = (payload: AirJamStateSyncPayload) => {
        if (payload.roomId !== roomId) {
          return;
        }
        if (payload.storeDomain !== resolvedStoreDomain) {
          return;
        }
        if (payload.revision < syncRevision) {
          return;
        }

        const nextStateData = stripActionsFromState(payload.data as Partial<T>);
        const nextSignature = JSON.stringify(nextStateData);
        const currentSignature = JSON.stringify(
          stripActionsFromState(store.getState()),
        );
        syncRevision = payload.revision;
        syncedStateData = nextStateData;
        syncedStateSignature = nextSignature;

        if (nextSignature === currentSignature) {
          return;
        }

        store.setState(nextStateData);
      };

      socket.on("server:controllerJoined", handleControllerJoined);
      socket.on("airjam:state_sync", handleSync);
      socket.on("airjam:state_sync_request", handleStateSyncRequest);
      socket.on("airjam:action_rpc", handleAction);

      return {
        refCount: 0,
        flushHostStateSync,
        cleanup: () => {
          unsubscribe();
          socket.off("server:controllerJoined", handleControllerJoined);
          socket.off("airjam:state_sync", handleSync);
          socket.off("airjam:state_sync_request", handleStateSyncRequest);
          socket.off("airjam:action_rpc", handleAction);
        },
      };
    }

    let latestSyncRevision = -1;

    const handleSync = (payload: AirJamStateSyncPayload) => {
      if (payload.storeDomain !== resolvedStoreDomain) {
        return;
      }
      if (payload.revision < latestSyncRevision) {
        return;
      }
      latestSyncRevision = payload.revision;
      const stateData = stripActionsFromState(payload.data as Partial<T>);
      store.setState(stateData);
    };

    socket.on("airjam:state_sync", handleSync);

    if (runtimeSnapshotRef.current.connectionStatus === "connected") {
      socket.emit("controller:state_sync_request", {
        roomId,
        storeDomain: resolvedStoreDomain,
      });
    }

    return {
      refCount: 0,
      cleanup: () => {
        socket.off("airjam:state_sync", handleSync);
      },
    };
  };

  const useSyncedStore = <U>(
    selector: (state: T) => U = (state) => state as unknown as U,
  ): U => {
    const slice = store(selector);

    const explicitDomain = options?.storeDomain;
    let resolvedStoreDomain: string;
    if (
      typeof explicitDomain === "string" &&
      explicitDomain.trim().length > 0
    ) {
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
    const connectionStatus = useAirJamState((state) => state.connectionStatus);
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
      () =>
        players
          .map((player) => player.id)
          .sort()
          .join(","),
      [players],
    );
    const socket: AirJamRealtimeClient =
      role === "host"
        ? getHostRealtimeClient((runtimeRole) => getSocket(runtimeRole))
        : getControllerRealtimeClient((runtimeRole) => getSocket(runtimeRole));

    runtimeSnapshotRef.current = {
      socket,
      role,
      roomId,
      resolvedStoreDomain,
      connectionStatus,
      canBroadcastHostState,
      connectedPlayerIds,
    };

    const runtimeBindingKey =
      socket && roomId && role
        ? [
            role,
            roomId,
            resolvedStoreDomain,
            socket.id ?? "socket",
            role === "controller" ? connectionStatus : "host",
          ].join(":")
        : null;

    useEffect(() => {
      if (!runtimeBindingKey || !socket || !roomId || !role) {
        return;
      }

      let binding = runtimeBindings.get(runtimeBindingKey);
      if (!binding) {
        binding = createRuntimeBinding({
          socket,
          role,
          roomId,
          resolvedStoreDomain,
        });
        runtimeBindings.set(runtimeBindingKey, binding);
      }

      binding.refCount += 1;

      return () => {
        const currentBinding = runtimeBindings.get(runtimeBindingKey);
        if (!currentBinding) {
          return;
        }

        currentBinding.refCount -= 1;
        if (currentBinding.refCount > 0) {
          return;
        }

        currentBinding.cleanup();
        runtimeBindings.delete(runtimeBindingKey);
      };
    }, [
      runtimeBindingKey,
      socket,
      role,
      roomId,
      socket?.id,
      resolvedStoreDomain,
    ]);

    useEffect(() => {
      if (
        !runtimeBindingKey ||
        role !== "host" ||
        !canBroadcastHostState ||
        !roomId
      ) {
        return;
      }

      const binding = runtimeBindings.get(runtimeBindingKey);
      if (!binding?.flushHostStateSync) {
        return;
      }

      const flushKey = [
        roomId,
        registeredRoomId,
        socket?.id ?? "socket",
        resolvedStoreDomain,
        playerRosterKey,
        canBroadcastHostState ? "broadcast" : "blocked",
      ].join(":");

      if (binding.lastHostFlushKey === flushKey) {
        return;
      }

      binding.lastHostFlushKey = flushKey;
      binding.flushHostStateSync();
    }, [
      role,
      roomId,
      registeredRoomId,
      socket?.id,
      playerRosterKey,
      resolvedStoreDomain,
      canBroadcastHostState,
      runtimeBindingKey,
    ]);

    const dispatchedActions = useMemo<AirJamActionDispatchMap<T["actions"]>>(
      () => createDispatchedActions({ kind: "default" }),
      [],
    );

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
    useSyncedStore((state) => state.actions) as AirJamActionDispatchMap<
      T["actions"]
    >;
  const asPlayer = (
    controllerId: string,
  ): AirJamActionDispatchMap<T["actions"]> =>
    createDispatchedActions({
      kind: "player",
      controllerId,
    });
  const subscribeHostActions = (
    listener: AirJamHostActionListener<T["actions"]>,
    options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
  ): (() => void) => {
    const actionNames =
      options?.actionNames && options.actionNames.length > 0
        ? new Set<string>(options.actionNames)
        : null;
    const registration: HostActionListenerRegistration<T["actions"]> = {
      actionNames,
      includeRejected: options?.includeRejected ?? false,
      listener,
    };
    hostActionListeners.add(registration);
    return () => {
      hostActionListeners.delete(registration);
    };
  };
  const useHostActionListener = (
    listener: AirJamHostActionListener<T["actions"]>,
    options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
  ): void => {
    const listenerRef = useRef(listener);
    useEffect(() => {
      listenerRef.current = listener;
    }, [listener]);

    const includeRejected = options?.includeRejected ?? false;
    const actionNamesKey = options?.actionNames?.join("\u0000") ?? "";

    useEffect(() => {
      return subscribeHostActions((event) => {
        listenerRef.current(event);
      }, options);
    }, [actionNamesKey, includeRejected, options]);
  };
  const useLiveStateRef = (): MutableRefObject<T> => {
    const latestState = useSyncedStore((state) => state);
    const stateRef = useRef<T>(latestState);

    useEffect(() => {
      stateRef.current = latestState;
    }, [latestState]);

    return stateRef;
  };
  syncedStore.useActions = useActions;
  syncedStore.asPlayer = asPlayer;
  syncedStore.getState = store.getState;
  syncedStore.subscribe = store.subscribe;
  syncedStore.subscribeHostActions = subscribeHostActions;
  syncedStore.useHostActionListener = useHostActionListener;
  syncedStore.useLiveStateRef = useLiveStateRef;

  return syncedStore;
}
