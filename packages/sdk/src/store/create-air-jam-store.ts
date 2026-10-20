import { useContext, useEffect, useRef, type MutableRefObject } from "react";
import { useStore } from "zustand";
import type { StateCreator, StoreApi } from "zustand/vanilla";
import {
  createReplicatedStore,
  type AirJamActionDispatchMap,
  type AirJamHostActionListener,
  type AirJamHostActionSubscriptionOptions,
  type AirJamInvalidActionPayloadDiagnostic,
  type AirJamNetworkedState,
  type AttachableStore,
  type CreateAirJamStoreOptions,
  type InvalidActionPayloadKeys,
  type ReplicatedStore,
} from "../core/replicated-store";
import { createAirJamDiagnosticError } from "../diagnostics";
import { declaredStoresContext } from "../runtime/runtime-owner-contexts";

export {
  acceptAirJamAction,
  isInternalActionName,
  rejectAirJamAction,
  type AirJamActionAcceptance,
  type AirJamActionContext,
  type AirJamActionRejection,
  type AirJamHostActionEvent,
  type AirJamHostActionListener,
  type AirJamHostActionSubscriptionOptions,
  type CreateAirJamStoreOptions,
} from "../core/replicated-store";

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
  /** The core store the runtime attaches; declare the hook in `createAirJamApp({ stores })`. */
  store: ReplicatedStore<T>;
};

/** A store hook a host or controller declares so its runtime syncs it. */
export interface AirJamStoreDeclaration {
  readonly store: AttachableStore;
}

const useRequireDeclaredStore = (store: ReplicatedStore<never>): void => {
  const declared = useContext(declaredStoresContext);
  if (!declared?.has(store))
    throw createAirJamDiagnosticError(
      "AJ_STORE_NOT_DECLARED",
      "This Air Jam store is used in a host or controller that does not declare it, so it would never sync with the room. Add its hook to createAirJamApp({ stores: [useYourStore] }).",
    );
};

/**
 * Creates a networked store that syncs state from host to controllers.
 *
 * Host is the source of truth: the host broadcasts state and controllers invoke
 * actions through RPC to the host. The store syncs while the runtime that
 * declares it runs, whether or not a component is reading it.
 *
 * `storeDomain` isolates sync and action RPC so multiple replicated stores can
 * coexist in one room (e.g. arcade shell vs running game). When omitted, it
 * resolves from the runtime URL: explicit `aj_store_domain`, else embedded
 * Arcade identity (`aj_arcade_*`), else the default domain.
 */
export function createAirJamStore<T extends AirJamNetworkedState>(
  initializer: InvalidActionPayloadKeys<T["actions"]> extends never
    ? StateCreator<T>
    : StateCreator<T> & AirJamInvalidActionPayloadDiagnostic<T["actions"]>,
  options?: CreateAirJamStoreOptions,
): AirJamSyncedStoreHook<T> {
  const store = createReplicatedStore<T>(initializer, options);

  const useSyncedStore = <U>(
    selector: (state: T) => U = (state) => state as unknown as U,
  ): U => {
    useRequireDeclaredStore(store as unknown as ReplicatedStore<never>);
    const slice = useStore(store.api, selector);
    const stateActions = store.api.getState().actions;
    if (slice === stateActions) return store.actions as U;
    if (
      typeof slice === "object" &&
      slice !== null &&
      "actions" in slice &&
      (slice as { actions: unknown }).actions === stateActions
    )
      return {
        ...(slice as Record<string, unknown>),
        actions: store.actions,
      } as U;
    return slice;
  };

  const useHostActionListener = (
    listener: AirJamHostActionListener<T["actions"]>,
    options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
  ): void => {
    const listenerRef = useRef(listener);
    const actionNamesRef = useRef(options?.actionNames);
    useEffect(() => {
      listenerRef.current = listener;
      actionNamesRef.current = options?.actionNames;
    });
    const includeRejected = options?.includeRejected ?? false;
    const actionNamesKey = options?.actionNames?.join("\u0000") ?? "";
    useEffect(
      () =>
        store.subscribeHostActions((event) => listenerRef.current(event), {
          includeRejected,
          actionNames: actionNamesRef.current,
        }),
      // The names are read through a ref; their joined key decides resubscription.
      [actionNamesKey, includeRejected],
    );
  };

  const useLiveStateRef = (): MutableRefObject<T> => {
    const latestState = useSyncedStore((state) => state);
    const stateRef = useRef<T>(latestState);
    useEffect(() => {
      stateRef.current = latestState;
    }, [latestState]);
    return stateRef;
  };

  const useActions = () =>
    useSyncedStore((state) => state.actions) as AirJamActionDispatchMap<
      T["actions"]
    >;

  const hook = useSyncedStore as AirJamSyncedStoreHook<T>;
  hook.useActions = useActions;
  hook.asPlayer = store.asPlayer;
  hook.getState = store.getState;
  hook.subscribe = store.subscribe;
  hook.subscribeHostActions = store.subscribeHostActions;
  hook.useHostActionListener = useHostActionListener;
  hook.useLiveStateRef = useLiveStateRef;
  hook.store = store;
  return hook;
}
