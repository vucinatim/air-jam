import { nanoid } from "nanoid";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { emitAirJamDiagnostic } from "../diagnostics";
import type {
  AirJamActionActorRole,
  AirJamActionInvocationResult,
  AirJamActionPayload,
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
} from "../protocol";
import {
  isHostRuntimeParticipantLeased,
  registerHostRuntimeActionStore,
} from "../runtime/contracts/control";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  AIR_JAM_DEFAULT_STORE_DOMAIN,
} from "../store/air-jam-store-domain-constants";
import { isRpcSerializable } from "../utils/is-rpc-serializable";
import type { AirJamStore } from "./connection-store";

const INTERNAL_ACTION_PREFIX = "_";
const UNRESOLVED_ACTOR_ID = "unknown";
const hostStateRevisions = new WeakMap<
  AirJamRealtimeClient,
  Map<string, { value: number }>
>();

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
export type AirJamActionMap = Record<string, AirJamActionHandler>;
export type AirJamActionName<TActions extends AirJamActionMap> = Extract<
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

export type InvalidActionPayloadKeys<TActions extends AirJamActionMap> = {
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

export type AirJamInvalidActionPayloadDiagnostic<
  TActions extends AirJamActionMap,
> = {
  readonly __airJamInvalidActionPayloads__: InvalidActionPayloadKeyNames<TActions>;
  readonly __airJamActionPayloadRule__: "Networked store action payloads must be omitted or one plain object payload. Unions like T | undefined, arrays, and primitives are not valid payload roots.";
};

export type AirJamNetworkedState<
  TActions extends AirJamActionMap = AirJamActionMap,
> = {
  actions: TActions;
};

export type AirJamActionDispatchMap<TActions extends AirJamActionMap> = {
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

export type InferAirJamActionResult<TResult> =
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
  hostStateSyncBlocked: boolean;
  hostStateRevisionFloor: number;
  connectedPlayerIds: string[];
}

interface StoreRuntimeBinding {
  flushHostStateSync?: () => void;
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

/** The room connection a replicated store syncs through while attached. */
export interface ReplicatedStoreSession {
  socket: AirJamRealtimeClient;
  connection: StoreApi<AirJamStore>;
  /** The store domain used when a store declares none. */
  defaultStoreDomain: string;
  /** Host only: where agent tools and devtools find this store's control. */
  controlTarget: object | null;
}

/** What a runtime needs from a store it attaches, whatever the store holds. */
export interface AttachableStore {
  attach: (session: ReplicatedStoreSession) => () => void;
  readonly attached: boolean;
}

/**
 * A store whose state the host owns and controllers mirror. Its actions run
 * on the host; controllers invoke them over the room. It syncs only while a
 * runtime has attached it to a session.
 */
export interface ReplicatedStore<
  T extends AirJamNetworkedState,
> extends AttachableStore {
  readonly api: StoreApi<T>;
  getState: () => T;
  subscribe: StoreApi<T>["subscribe"];
  /** Public actions dispatched as the local surface: the host runs them, a controller sends them. */
  readonly actions: AirJamActionDispatchMap<T["actions"]>;
  asPlayer: (controllerId: string) => AirJamActionDispatchMap<T["actions"]>;
  subscribeHostActions: (
    listener: AirJamHostActionListener<T["actions"]>,
    options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
  ) => () => void;
}

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

/** How long an action called before its session connects waits for it. */
const AIR_JAM_ACTION_SESSION_WAIT_MS = 10_000;

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
export function createReplicatedStore<T extends AirJamNetworkedState>(
  initializer: StateCreator<T>,
  options?: CreateAirJamStoreOptions,
): ReplicatedStore<T> {
  const store = createStore<T>((set, get, api) => initializer(set, get, api));
  const stateEpoch = nanoid();
  const runtimeSnapshotRef: { current: StoreRuntimeSnapshot } = {
    current: {
      socket: null,
      role: null,
      roomId: null,
      resolvedStoreDomain: AIR_JAM_DEFAULT_STORE_DOMAIN,
      connectionStatus: null,
      canBroadcastHostState: false,
      hostStateSyncBlocked: false,
      hostStateRevisionFloor: 0,
      connectedPlayerIds: [],
    },
  };
  // Actions called while the session is still connecting (for example from
  // a component that mounts before its room exists) wait for it instead of
  // being dropped.
  const sessionWaiters = new Set<() => void>();
  const sessionReady = (runtime: StoreRuntimeSnapshot) =>
    runtime.role === "host" ||
    (runtime.role === "controller" && Boolean(runtime.roomId));
  const waitForSession = () =>
    new Promise<StoreRuntimeSnapshot>((resolve) => {
      const finish = () => {
        clearTimeout(timeout);
        sessionWaiters.delete(finish);
        resolve(runtimeSnapshotRef.current);
      };
      const timeout = setTimeout(finish, AIR_JAM_ACTION_SESSION_WAIT_MS);
      sessionWaiters.add(finish);
    });
  const hostActionListeners = new Set<
    HostActionListenerRegistration<T["actions"]>
  >();

  const createDispatchedActions = (
    ownerStore: StoreApi<T>,
    mode:
      | {
          kind: "default";
        }
      | {
          kind: "player";
          controllerId: string;
        },
  ): AirJamActionDispatchMap<T["actions"]> => {
    const sourceActions = ownerStore.getState().actions;
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

        const runtime = sessionReady(runtimeSnapshotRef.current)
          ? runtimeSnapshotRef.current
          : await waitForSession();

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
            severity: "error",
            message: `[AirJamStore] Action "${actionName}" dropped: the session was not ready within ${AIR_JAM_ACTION_SESSION_WAIT_MS / 1000} s.`,
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
    controlTarget,
  }: {
    socket: AirJamRealtimeClient;
    role: AirJamActionActorRole;
    roomId: string;
    resolvedStoreDomain: string;
    controlTarget: object | null;
  }): StoreRuntimeBinding => {
    if (role === "host") {
      let syncedStateData = stripActionsFromState(store.getState());
      let syncedStateSignature = JSON.stringify(syncedStateData);
      let revisions = hostStateRevisions.get(socket);
      if (!revisions) {
        revisions = new Map();
        hostStateRevisions.set(socket, revisions);
      }
      const revisionKey = JSON.stringify([roomId, resolvedStoreDomain]);
      let syncRevision = revisions.get(revisionKey);
      if (syncRevision) {
        syncRevision.value = Math.max(
          syncRevision.value + 1,
          runtimeSnapshotRef.current.hostStateRevisionFloor,
        );
      } else {
        syncRevision = {
          value: runtimeSnapshotRef.current.hostStateRevisionFloor,
        };
        revisions.set(revisionKey, syncRevision);
      }

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

        syncRevision.value = Math.max(
          syncRevision.value,
          runtime.hostStateRevisionFloor,
        );

        runtime.socket.emit("host:state_sync", {
          roomId,
          data: syncedStateData,
          storeDomain: resolvedStoreDomain,
          revision: syncRevision.value,
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
          runtime.resolvedStoreDomain !== resolvedStoreDomain
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
        syncRevision.value = Math.max(
          syncRevision.value,
          runtime.hostStateRevisionFloor,
        );
        syncRevision.value += 1;
        if (runtime.canBroadcastHostState && runtime.socket) {
          emitHostStateSync();
        }
      });

      const dispatchActionRpc = (
        payload: AirJamActionRpcPayload,
      ): AirJamActionInvocationResult => {
        const { actionName } = payload;
        if (isInternalActionName(actionName)) {
          return createServerRejectedActionResult(
            "internal_action",
            "Internal store actions cannot be invoked by controllers.",
          );
        }

        const runtime = runtimeSnapshotRef.current;
        const actionFn = store.getState().actions[actionName];
        if (typeof actionFn !== "function") {
          return createServerRejectedActionResult(
            "action_not_found",
            `Store action "${actionName}" is not registered on the host.`,
            {
              actionName,
              storeDomain: resolvedStoreDomain,
            },
          );
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
          return acknowledgement;
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
          return acknowledgement;
        }
      };

      const handleAction = (
        payload: AirJamActionRpcPayload,
        callback?: (ack: AirJamActionInvocationResult) => void,
      ) => {
        if (payload.storeDomain !== resolvedStoreDomain) return;
        if (
          controlTarget &&
          payload.actor.role === "controller" &&
          isHostRuntimeParticipantLeased(
            controlTarget,
            roomId,
            payload.actor.id,
          )
        ) {
          callback?.(
            createServerRejectedActionResult(
              "participant_control_leased",
              "This controller is owned by a participant-control lease.",
            ),
          );
          return;
        }
        const acknowledgement = dispatchActionRpc(payload);
        callback?.(acknowledgement);
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
        if (runtimeSnapshotRef.current.hostStateSyncBlocked) {
          return;
        }
        if (payload.revision < syncRevision.value) {
          return;
        }

        const nextStateData = stripActionsFromState(payload.data as Partial<T>);
        const nextSignature = JSON.stringify(nextStateData);
        const currentSignature = JSON.stringify(
          stripActionsFromState(store.getState()),
        );
        syncRevision.value = payload.revision;
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

      const canUseHostControl = () => {
        const runtime = runtimeSnapshotRef.current;
        return (
          runtime.role === "host" &&
          runtime.roomId === roomId &&
          runtime.resolvedStoreDomain === resolvedStoreDomain &&
          runtime.socket === socket &&
          runtime.canBroadcastHostState
        );
      };

      const unregisterControl = !controlTarget
        ? undefined
        : registerHostRuntimeActionStore(controlTarget, {
            roomId,
            storeDomain: resolvedStoreDomain,
            stateEpoch,
            contractStoreDomain: options?.storeDomain?.trim() || "default",
            read: () => {
              if (!canUseHostControl())
                throw new Error("host_runtime_not_ready");
              return {
                data: stripActionsFromState(store.getState()),
                revision: syncRevision.value,
              };
            },
            dispatchParticipant: ({ controllerId, actionName, payload }) => {
              if (!canUseHostControl())
                return createClientRejectedActionResult(
                  "host_runtime_not_ready",
                  "The owning host runtime is not ready for actions.",
                );
              return dispatchActionRpc({
                actionName,
                payload,
                storeDomain: resolvedStoreDomain,
                actor: { id: controllerId, role: "controller" },
              });
            },
            invoke: async ({ actionName, payload }) => {
              if (!canUseHostControl()) {
                return createClientRejectedActionResult(
                  "host_runtime_not_ready",
                  "The owning host runtime is not ready for actions.",
                );
              }
              const actions = createDispatchedActions(store, {
                kind: "default",
              });
              if (!Object.hasOwn(actions, actionName)) {
                return createClientRejectedActionResult(
                  "action_not_found",
                  "The requested public action is not registered on this host store.",
                );
              }
              const invoke = actions[actionName] as (
                payload: unknown,
              ) => Promise<AirJamActionInvocationResult>;
              return invoke(payload);
            },
          });

      return {
        flushHostStateSync,
        cleanup: () => {
          unregisterControl?.();
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
      cleanup: () => {
        socket.off("airjam:state_sync", handleSync);
      },
    };
  };

  const resolveStoreDomain = (defaultStoreDomain: string): string => {
    const explicit = options?.storeDomain?.trim();
    if (!explicit) return defaultStoreDomain;
    return explicit.length > 128 ? explicit.slice(0, 128) : explicit;
  };

  let attachedSession: ReplicatedStoreSession | null = null;

  const attach = (session: ReplicatedStoreSession): (() => void) => {
    if (attachedSession)
      throw new Error(
        "This Air Jam store is already attached to a running session.",
      );
    attachedSession = session;
    const resolvedStoreDomain = resolveStoreDomain(session.defaultStoreDomain);
    const socket = session.socket;
    let binding: { key: string; value: StoreRuntimeBinding } | null = null;
    let lastHostFlushKey: string | null = null;

    const update = (): void => {
      const connection = session.connection.getState();
      const role = connection.role;
      const roomId = connection.roomId;
      const blockArcadeShellHostStateSync =
        resolvedStoreDomain === AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN &&
        connection.hostArcadeRestore.phase !== "idle";
      const canBroadcastHostState =
        role === "host" &&
        !!roomId &&
        connection.registeredRoomId === roomId &&
        !blockArcadeShellHostStateSync;
      const connectedPlayerIds = Array.from(
        new Set(connection.players.map((player) => player.id)),
      ).sort();
      runtimeSnapshotRef.current = {
        socket,
        role,
        roomId,
        resolvedStoreDomain,
        connectionStatus: connection.connectionStatus,
        canBroadcastHostState,
        hostStateSyncBlocked: blockArcadeShellHostStateSync,
        hostStateRevisionFloor:
          resolvedStoreDomain === AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN
            ? (connection.hostArcadeRestore.surfaceCheckpoint?.revision ?? 0)
            : 0,
        connectedPlayerIds,
      };
      if (sessionReady(runtimeSnapshotRef.current))
        for (const release of [...sessionWaiters]) release();

      const bindingKey =
        roomId && role
          ? [
              role,
              roomId,
              resolvedStoreDomain,
              socket.id ?? "socket",
              role === "controller" ? connection.connectionStatus : "host",
            ].join(":")
          : null;
      if (binding?.key !== bindingKey) {
        binding?.value.cleanup();
        binding = null;
        lastHostFlushKey = null;
        if (bindingKey && roomId && role)
          binding = {
            key: bindingKey,
            value: createRuntimeBinding({
              socket,
              role,
              roomId,
              resolvedStoreDomain,
              controlTarget: role === "host" ? session.controlTarget : null,
            }),
          };
      }

      if (!binding || role !== "host" || !canBroadcastHostState || !roomId)
        return;
      const flushKey = [
        roomId,
        connection.registeredRoomId,
        socket.id ?? "socket",
        resolvedStoreDomain,
        connectedPlayerIds.join(","),
        "broadcast",
      ].join(":");
      if (lastHostFlushKey === flushKey) return;
      lastHostFlushKey = flushKey;
      binding.value.flushHostStateSync?.();
    };

    const unsubscribe = session.connection.subscribe(update);
    update();
    return () => {
      unsubscribe();
      binding?.value.cleanup();
      binding = null;
      attachedSession = null;
      runtimeSnapshotRef.current = {
        ...runtimeSnapshotRef.current,
        socket: null,
        role: null,
        roomId: null,
        canBroadcastHostState: false,
      };
    };
  };

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

  return {
    api: store,
    getState: store.getState,
    subscribe: store.subscribe,
    actions: createDispatchedActions(store, { kind: "default" }),
    asPlayer: (controllerId) =>
      createDispatchedActions(store, { kind: "player", controllerId }),
    subscribeHostActions,
    attach,
    get attached() {
      return attachedSession !== null;
    },
  };
}
