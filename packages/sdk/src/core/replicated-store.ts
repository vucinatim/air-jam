import { nanoid } from "nanoid";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { emitAirJamDiagnostic } from "../diagnostics";
import {
  airJamActionInvocationResultSchema,
  type AirJamActionActor,
  type AirJamActionActorRole,
  type AirJamActionInvocationResult,
  type AirJamActionPayload,
} from "../protocol/actions";
import { AIRJAM_DEV_LOG_EVENTS } from "../protocol/dev-log-events";
import type { ChannelCopy, SeatId, StateDocument } from "../room-protocol";
import type { PublishOptions } from "../room-session/channel-state";
import type { RoomRequestOutcome } from "../room-session/phone-room-session";
import {
  isHostRuntimeParticipantLeased,
  registerHostRuntimeActionStore,
} from "../runtime/contracts/control";
import { isRpcSerializable } from "../utils/is-rpc-serializable";
import type { AirJamConnectionState } from "./connection-store";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";
import type { SettingsValues } from "./settings";

const INTERNAL_ACTION_PREFIX = "_";

export type AirJamPrivateField<T> = {
  [K in Exclude<keyof T, "actions">]: T[K] extends Record<string, unknown>
    ? string extends keyof T[K]
      ? K
      : never
    : never;
}[Exclude<keyof T, "actions">] &
  string;

export type AirJamPrivateEntry<
  T,
  K extends AirJamPrivateField<T> = AirJamPrivateField<T>,
> = T[K] extends Record<string, infer Entry> ? Entry : never;

export interface CreateAirJamStoreOptions<
  T = never,
  K extends AirJamPrivateField<T> = AirJamPrivateField<T>,
> {
  privateField?: K;
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

export interface AirJamActionContext<TSettings = Record<string, never>> {
  settings: TSettings;
  actorId: string;
  role: AirJamActionActorRole;
  connectedPlayerIds: string[];
  /**
   * Game time in milliseconds when the action runs: the simulation's time when
   * the game declares one, else the host's clock. Read it instead of the wall
   * clock so headless runs and replays see the same time.
   */
  now: number;
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

type AirJamActionHandler = {
  invoke(
    ctx: AirJamActionContext<SettingsValues>,
    // Internal existential handler shape for heterogenous action maps.
    // Store authors still get precise payload types through inference at the public API.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any,
  ): unknown;
}["invoke"];
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
    ctx: infer _Context,
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
    ctx: infer _Context,
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
  room: AirJamStoreRoom | null;
  roomId: string | null;
  resolvedStoreDomain: string;
  controllerId: string | null;
  connectedPlayerIds: string[];
  now: () => number;
  settings?: () => SettingsValues;
}

/** One invocation of a store action, from the host itself or a phone's request. */
export interface StoreActionCall {
  actionName: string;
  payload: unknown;
  storeDomain: string;
  actor: AirJamActionActor;
}

export type AirJamHostActionEvent<
  TActions extends AirJamActionMap = AirJamActionMap,
  TActionName extends AirJamActionName<TActions> = AirJamActionName<TActions>,
> =
  TActionName extends AirJamActionName<TActions>
    ? TActions[TActionName] extends (
        ctx: infer _Context,
        payload: infer TPayload,
      ) => infer TResult
      ? {
          actionName: TActionName;
          payload: TPayload;
          context: AirJamActionContext<SettingsValues>;
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

/** A phone's request on a store's channel, stamped by the room with its seat. */
export interface AirJamStoreRequest {
  readonly seat: SeatId;
  readonly name: string;
  readonly payload: unknown;
}

/**
 * The room as a replicated store sees it: on the host, the channel it
 * publishes and the requests it answers; on a phone, the channel it mirrors
 * and the requests it makes. The store's domain is its channel.
 */
export type AirJamStoreRoom =
  | {
      readonly role: "host";
      publish(
        channel: string,
        document: StateDocument,
        options: PublishOptions,
      ): void;
      /**
       * Calls `restore` once, with the room's copy of the channel, when this
       * host first returns to a room that holds one.
       */
      onRestore(
        channel: string,
        restore: (copy: ChannelCopy) => void,
      ): () => void;
      /** Answers phones' requests on the channel with what `answer` returns. */
      answer(
        channel: string,
        answer: (request: AirJamStoreRequest) => unknown,
      ): () => void;
    }
  | {
      readonly role: "controller";
      document(channel: string): StateDocument | undefined;
      /** Calls `listener` with each new copy of the channel. */
      onDocument(
        channel: string,
        listener: (document: StateDocument) => void,
      ): () => void;
      request(
        channel: string,
        name: string,
        payload: unknown,
      ): Promise<RoomRequestOutcome>;
    };

/** The room connection a replicated store syncs through while attached. */
export interface AirJamStoreSession {
  room: AirJamStoreRoom;
  connection: StoreApi<AirJamConnectionState>;
  /** The store domain used when a store declares none. */
  defaultStoreDomain: string;
  emitDevEvent?: (detail: AirJamDevRuntimeEventDetail) => void;
  /** Host only: where agent tools and devtools find this store's control. */
  controlTarget: object | null;
  /** The surface's game clock; actions the host runs read it as `ctx.now`. */
  now: () => number;
  settings?: () => SettingsValues;
}

/** What a runtime needs from a store it attaches, whatever the store holds. */
export interface AttachableStore {
  attach: (session: AirJamStoreSession) => () => void;
  readonly attached: boolean;
  /** Runs an action a recorded match applied between steps, as its recorded actor, when it belongs to this store. */
  replayAction(call: StoreActionCall): void;
  subscribeHostActions(
    listener: AirJamHostActionListener,
    options?: AirJamHostActionSubscriptionOptions,
  ): () => void;
}

/**
 * A store whose state the host owns and controllers mirror. Its actions run
 * on the host; controllers invoke them over the room. It syncs while a runtime
 * that declares it runs; React reads it with `useAirJamStore`.
 */
export interface AirJamStore<
  T extends AirJamNetworkedState,
  PrivateEntry = AirJamPrivateEntry<T>,
> extends AttachableStore {
  readonly api: StoreApi<T>;
  getState: () => T;
  getPrivateState: () => PrivateEntry | undefined;
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

/** A phone's action result from how its request on the store's channel ended. */
export const airJamActionResultOf = (
  outcome: RoomRequestOutcome,
): AirJamActionInvocationResult => {
  switch (outcome.status) {
    case "answered": {
      const parsed = airJamActionInvocationResultSchema.safeParse(
        outcome.result,
      );
      return parsed.success
        ? parsed.data
        : createServerRejectedActionResult(
            "invalid_answer",
            "The host's answer was not an action result.",
          );
    }
    case "refused":
      return createServerRejectedActionResult(
        "host_away",
        "The host is away, so the action did not run.",
      );
    case "unconfirmed":
    case "busy":
      return { ok: false, status: "unconfirmed", source: "client" };
  }
};

const stripActionsFromState = <T extends AirJamNetworkedState>(
  data: Partial<T>,
): Partial<T> => {
  const { actions: _ignored, ...stateData } = data as Partial<T> & {
    actions?: unknown;
  };
  return stateData as Partial<T>;
};

/**
 * A store's shape as a bounded fingerprint: two FNV-1a passes over its
 * canonical shape, 64 bits as hex, so any store fits the state frame.
 */
const shapeFingerprintOf = (shape: string): string => {
  let first = 0x811c9dc5;
  let second = 0x01000193;
  for (let index = 0; index < shape.length; index += 1) {
    const code = shape.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x811c9dc5) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
};

const stateShape = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `array[${[...new Set(value.map(stateShape))].sort().join(",")}]`;
  }
  if (typeof value === "object") {
    return `object{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stateShape(Reflect.get(value, key))}`,
      )
      .join(",")}}`;
  }
  return typeof value;
};

const toActionContext = (
  call: StoreActionCall,
  runtime: StoreRuntimeSnapshot,
): AirJamActionContext<SettingsValues> => ({
  actorId: call.actor.id,
  role: call.actor.role,
  connectedPlayerIds: runtime.connectedPlayerIds,
  now: runtime.now(),
  settings: runtime.settings?.() ?? {},
});

const detachedClock = (): number => {
  throw new Error("This Air Jam store is not attached to a running session.");
};

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
/**
 * Creates a networked store. The host is the source of truth: it applies
 * actions and broadcasts state; controllers invoke actions through RPC and
 * mirror the state. Declare the store in the game so its runtimes sync it.
 *
 * `storeDomain` isolates sync and action RPC so several stores can share a
 * room (e.g. an Arcade shell and its game). When omitted, it follows the
 * runtime's environment: an explicit `aj_store_domain`, else the embedded
 * Arcade identity, else the default domain.
 */
export function createAirJamStore<
  T extends AirJamNetworkedState,
  K extends AirJamPrivateField<T> = AirJamPrivateField<T>,
>(
  initializer: InvalidActionPayloadKeys<T["actions"]> extends never
    ? StateCreator<T>
    : StateCreator<T> & AirJamInvalidActionPayloadDiagnostic<T["actions"]>,
  options?: CreateAirJamStoreOptions<T, K>,
): AirJamStore<T, AirJamPrivateEntry<T, K>> {
  const store = createStore<T>((set, get, api) => initializer(set, get, api));
  const shapeFingerprint = shapeFingerprintOf(
    stateShape(stripActionsFromState<T>(store.getInitialState())),
  );
  const privateField = options?.privateField;
  const privateEntries = (state: Partial<T>): Record<string, unknown> => {
    if (!privateField) return {};
    const entries = state[privateField];
    if (!entries || typeof entries !== "object" || Array.isArray(entries))
      throw new Error(
        "A private store field must be a map keyed by controllerId.",
      );
    return entries as Record<string, unknown>;
  };
  const projectState = (state: Partial<T>, controllerId: string | null) => {
    const data = { ...state };
    if (privateField) {
      const entry = controllerId
        ? privateEntries(state)[controllerId]
        : undefined;
      Object.assign(data, {
        [privateField]:
          controllerId && entry !== undefined ? { [controllerId]: entry } : {},
      });
    }
    return data;
  };
  if (privateField) privateEntries(store.getState());
  const stateEpoch = nanoid();
  const runtimeSnapshotRef: { current: StoreRuntimeSnapshot } = {
    current: {
      room: null,
      roomId: null,
      resolvedStoreDomain: "",
      controllerId: null,
      connectedPlayerIds: [],
      now: detachedClock,
    },
  };
  // Actions called before a runtime attaches the store (for example from a
  // component that mounts before its runtime starts) wait for it instead of
  // being dropped. Once attached, a phone's requests wait in its session
  // while its link is down.
  const sessionWaiters = new Set<() => void>();
  const sessionReady = (runtime: StoreRuntimeSnapshot) => runtime.room !== null;
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
            message: `[AirJamConnectionState] Action "${actionName}" received an event-like payload. Dropping payload and continuing.`,
            details: { actionName },
          });
        }

        const runtime = sessionReady(runtimeSnapshotRef.current)
          ? runtimeSnapshotRef.current
          : await waitForSession();

        const role = runtime.room?.role ?? null;
        if (mode.kind === "player" && role !== "host") {
          emitAirJamDiagnostic({
            code: "AJ_STORE_PLAYER_ACTIONS_HOST_ONLY",
            severity: "warn",
            message: `[AirJamConnectionState] Player impersonation for action "${actionName}" is host-only.`,
            details: {
              actionName,
              role,
              controllerId: mode.controllerId,
            },
          });
          return createClientRejectedActionResult(
            "player_actions_host_only",
            `Store action "${actionName}" cannot impersonate a player outside the host runtime.`,
            {
              actionName,
              ...(role ? { role } : {}),
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
              message: `[AirJamConnectionState] Player impersonation for action "${actionName}" requires a non-empty controller id.`,
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
              message: `[AirJamConnectionState] Player impersonation for action "${actionName}" requires a currently connected controller.`,
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

        if (role === "host") {
          try {
            const context =
              mode.kind === "player"
                ? ({
                    actorId: mode.controllerId.trim(),
                    role: "controller",
                    connectedPlayerIds: runtime.connectedPlayerIds,
                    now: runtime.now(),
                    settings: runtime.settings?.() ?? {},
                  } satisfies AirJamActionContext<SettingsValues>)
                : ({
                    actorId: "host",
                    role: "host",
                    connectedPlayerIds: runtime.connectedPlayerIds,
                    now: runtime.now(),
                    settings: runtime.settings?.() ?? {},
                  } satisfies AirJamActionContext<SettingsValues>);
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
                now: runtime.now(),
                settings: runtime.settings?.() ?? {},
              },
              acknowledgement,
              invocationKind: "local",
              roomId: runtime.roomId,
              storeDomain: runtime.resolvedStoreDomain,
            } as AirJamHostActionEvent<T["actions"], typeof typedActionName>);
            return acknowledgement;
          }
        }

        const room = runtime.room;
        if (!room || room.role !== "controller") {
          emitAirJamDiagnostic({
            code: "AJ_STORE_ACTION_SESSION_NOT_READY",
            severity: "error",
            message: `[AirJamConnectionState] Action "${actionName}" dropped: the session was not ready within ${AIR_JAM_ACTION_SESSION_WAIT_MS / 1000} s.`,
            details: { actionName },
          });
          return createClientRejectedActionResult(
            "session_not_ready",
            `Store action "${actionName}" cannot run because the controller session is not ready.`,
            { actionName },
          );
        }

        if (!isRpcSerializable(normalizedPayload)) {
          emitAirJamDiagnostic({
            code: "AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE",
            severity: "warn",
            message: `[AirJamConnectionState] Action "${actionName}" blocked: payload must be RPC-serializable.`,
            details: { actionName },
          });
          return createClientRejectedActionResult(
            "payload_not_serializable",
            `Store action "${actionName}" requires an RPC-serializable payload.`,
            { actionName },
          );
        }

        if (
          normalizedPayload !== undefined &&
          !isPlainActionPayload(normalizedPayload)
        ) {
          emitAirJamDiagnostic({
            code: "AJ_STORE_ACTION_PAYLOAD_INVALID_SHAPE",
            severity: "warn",
            message: `[AirJamConnectionState] Action "${actionName}" blocked: payload must be omitted or a plain object.`,
            details: { actionName },
          });
          return createClientRejectedActionResult(
            "payload_invalid_shape",
            `Store action "${actionName}" requires an omitted payload or a plain object payload.`,
            { actionName },
          );
        }

        return airJamActionResultOf(
          await room.request(
            runtime.resolvedStoreDomain,
            actionName,
            normalizedPayload,
          ),
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
          `[AirJamConnectionState] Host action listener for "${event.actionName}" threw.`,
          error,
        );
      }
    }
  };

  const dispatchActionCall = (
    call: StoreActionCall,
  ): AirJamActionInvocationResult => {
    const { actionName } = call;
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
          storeDomain: call.storeDomain,
        },
      );
    }

    const context = toActionContext(call, runtime);
    let acknowledgement: AirJamActionInvocationResult;
    try {
      acknowledgement = normalizeAirJamActionInvocationResult(
        actionFn(context, call.payload),
        "host",
      );
    } catch (error) {
      acknowledgement = {
        ok: false,
        status: "rejected",
        source: "host",
        reason: "handler_error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const typedActionName = actionName as AirJamActionName<T["actions"]>;
    notifyHostActionListeners({
      actionName: typedActionName,
      payload: call.payload,
      context,
      acknowledgement,
      invocationKind: "rpc",
      roomId: runtime.roomId,
      storeDomain: call.storeDomain,
    } as AirJamHostActionEvent<T["actions"], typeof typedActionName>);
    return acknowledgement;
  };

  /** What the host publishes: the state without its actions, private entries whole. */
  const documentOf = (state: T): StateDocument =>
    stripActionsFromState<T>(state) as StateDocument;
  const publishOptions: PublishOptions = {
    fingerprint: shapeFingerprint,
    ...(privateField ? { private: privateField } : {}),
  };
  /** Counts the host's changes, so agents reading the store can tell one state from the next. */
  let hostRevision = 0;

  const bindHost = (
    room: Extract<AirJamStoreRoom, { role: "host" }>,
    channel: string,
    session: AirJamStoreSession,
  ): (() => void) => {
    room.publish(channel, documentOf(store.getState()), publishOptions);
    const unsubscribe = store.subscribe((state) => {
      hostRevision += 1;
      room.publish(channel, documentOf(state), publishOptions);
    });
    const stopRestore = room.onRestore(channel, (copy) => {
      if (copy.fingerprint !== shapeFingerprint) {
        session.emitDevEvent?.({
          event: AIRJAM_DEV_LOG_EVENTS.host.stateRestoreDiscarded,
          level: "info",
          role: "host",
          roomId: runtimeSnapshotRef.current.roomId ?? undefined,
          message:
            "Host kept fresh state because the restored store shape changed",
          data: { storeDomain: channel, reason: "shape_changed" },
        });
        return;
      }
      store.setState(
        stripActionsFromState<T>({
          ...store.getState(),
          ...(copy.document as Partial<T>),
        }),
      );
    });
    const stopAnswering = room.answer(channel, (request) => {
      const controlTarget = session.controlTarget;
      const roomId = runtimeSnapshotRef.current.roomId;
      if (
        controlTarget &&
        roomId &&
        isHostRuntimeParticipantLeased(controlTarget, roomId, request.seat)
      )
        return createServerRejectedActionResult(
          "participant_control_leased",
          "This controller is owned by a participant-control lease.",
        );
      return dispatchActionCall({
        actionName: request.name,
        payload: request.payload,
        storeDomain: channel,
        actor: { id: request.seat, role: "controller" },
      });
    });
    return () => {
      unsubscribe();
      stopRestore();
      stopAnswering();
    };
  };

  /** Agent tools and devtools find a host's store through its room's control registry. */
  const registerControl = (
    controlTarget: object,
    roomId: string,
    channel: string,
  ): (() => void) => {
    const canUseHostControl = () => {
      const runtime = runtimeSnapshotRef.current;
      return runtime.room?.role === "host" && runtime.roomId === roomId;
    };
    return registerHostRuntimeActionStore(controlTarget, {
      roomId,
      storeDomain: channel,
      stateEpoch,
      contractStoreDomain: options?.storeDomain?.trim() || "default",
      read: (controllerId) => {
        if (!canUseHostControl()) throw new Error("host_runtime_not_ready");
        return {
          data:
            controllerId === undefined
              ? stripActionsFromState<T>(store.getState())
              : projectState(
                  stripActionsFromState<T>(store.getState()),
                  controllerId,
                ),
          revision: hostRevision,
        };
      },
      dispatchParticipant: ({ controllerId, actionName, payload }) => {
        if (!canUseHostControl())
          return createClientRejectedActionResult(
            "host_runtime_not_ready",
            "The owning host runtime is not ready for actions.",
          );
        return dispatchActionCall({
          actionName,
          payload,
          storeDomain: channel,
          actor: { id: controllerId, role: "controller" },
        });
      },
      invoke: async ({ actionName, payload }) => {
        if (!canUseHostControl())
          return createClientRejectedActionResult(
            "host_runtime_not_ready",
            "The owning host runtime is not ready for actions.",
          );
        const actions = createDispatchedActions(store, { kind: "default" });
        if (!Object.hasOwn(actions, actionName))
          return createClientRejectedActionResult(
            "action_not_found",
            "The requested public action is not registered on this host store.",
          );
        const invoke = actions[actionName] as (
          payload: unknown,
        ) => Promise<AirJamActionInvocationResult>;
        return invoke(payload);
      },
    });
  };

  const bindController = (
    room: Extract<AirJamStoreRoom, { role: "controller" }>,
    channel: string,
  ): (() => void) => {
    const mirror = (document: StateDocument) =>
      store.setState(stripActionsFromState<T>(document as Partial<T>));
    const current = room.document(channel);
    if (current) mirror(current);
    return room.onDocument(channel, mirror);
  };

  const resolveStoreDomain = (defaultStoreDomain: string): string => {
    const explicit = options?.storeDomain?.trim();
    if (!explicit) return defaultStoreDomain;
    return explicit.length > 128 ? explicit.slice(0, 128) : explicit;
  };

  let attachedSession: AirJamStoreSession | null = null;

  const attach = (session: AirJamStoreSession): (() => void) => {
    if (attachedSession)
      throw new Error(
        "This Air Jam store is already attached to a running session.",
      );
    attachedSession = session;
    const channel = resolveStoreDomain(session.defaultStoreDomain);
    let control: { roomId: string; release: () => void } | null = null;

    const update = (): void => {
      const connection = session.connection.getState();
      runtimeSnapshotRef.current = {
        room: session.room,
        roomId: connection.roomId,
        resolvedStoreDomain: channel,
        controllerId: connection.controllerId,
        connectedPlayerIds: connection.players
          .filter((player) => player.connected)
          .map((player) => player.id)
          .sort(),
        now: session.now,
        settings: session.settings,
      };
      for (const release of [...sessionWaiters]) release();
      const controlTarget = session.controlTarget;
      const roomId = connection.roomId;
      if (control?.roomId === roomId) return;
      control?.release();
      control =
        controlTarget && roomId && session.room.role === "host"
          ? { roomId, release: registerControl(controlTarget, roomId, channel) }
          : null;
    };

    const unsubscribe = session.connection.subscribe(update);
    update();
    const unbind =
      session.room.role === "host"
        ? bindHost(session.room, channel, session)
        : bindController(session.room, channel);
    return () => {
      unsubscribe();
      unbind();
      control?.release();
      control = null;
      attachedSession = null;
      runtimeSnapshotRef.current = {
        ...runtimeSnapshotRef.current,
        room: null,
        roomId: null,
        now: detachedClock,
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
    getPrivateState: () => {
      const controllerId = runtimeSnapshotRef.current.controllerId;
      return controllerId && privateField
        ? (privateEntries(store.getState())[controllerId] as
            | AirJamPrivateEntry<T, K>
            | undefined)
        : undefined;
    },
    subscribe: store.subscribe,
    actions: createDispatchedActions(store, { kind: "default" }),
    asPlayer: (controllerId) =>
      createDispatchedActions(store, { kind: "player", controllerId }),
    subscribeHostActions,
    attach,
    replayAction: (call) => {
      const runtime = runtimeSnapshotRef.current;
      if (
        runtime.room?.role === "host" &&
        call.storeDomain === runtime.resolvedStoreDomain
      )
        dispatchActionCall(call);
    },
    get attached() {
      return attachedSession !== null;
    },
  };
}
