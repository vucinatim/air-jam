import { useContext, useEffect, useRef } from "react";
import { useStore } from "zustand";
import type {
  AirJamHostActionListener,
  AirJamHostActionSubscriptionOptions,
  AirJamNetworkedState,
  AirJamStore,
  AttachableStore,
} from "../core/replicated-store";
import { createAirJamDiagnosticError } from "../diagnostics";
import { declaredStoresContext } from "../runtime/runtime-owner-contexts";

const useRequireDeclaredStore = (store: AttachableStore): void => {
  const declared = useContext(declaredStoresContext);
  if (!declared?.has(store))
    throw createAirJamDiagnosticError(
      "AJ_STORE_NOT_DECLARED",
      "This Air Jam store is used in a host or controller that does not declare it, so it would never sync with the room. Add it to createAirJamApp({ stores: [yourStore] }).",
    );
};

/**
 * Reads a networked store and re-renders when the selected slice changes.
 * Dispatch actions through `store.actions`.
 */
export function useAirJamStore<T extends AirJamNetworkedState>(
  store: AirJamStore<T>,
): T;
export function useAirJamStore<T extends AirJamNetworkedState, U>(
  store: AirJamStore<T>,
  selector: (state: T) => U,
): U;
export function useAirJamStore<T extends AirJamNetworkedState, U>(
  store: AirJamStore<T>,
  selector: (state: T) => U = (state) => state as unknown as U,
): U {
  useRequireDeclaredStore(store);
  return useStore(store.api, selector);
}

/** Calls the listener for every action the host applies to the store while mounted. */
export function useHostActionListener<T extends AirJamNetworkedState>(
  store: AirJamStore<T>,
  listener: AirJamHostActionListener<T["actions"]>,
  options?: AirJamHostActionSubscriptionOptions<T["actions"]>,
): void {
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
    [store, actionNamesKey, includeRejected],
  );
}
