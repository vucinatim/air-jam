import {
  isLocalDevControlSurfaceTopology,
  readRuntimeTopologyFromWindow,
} from "@air-jam/runtime-topology";
import {
  type AirJamSyncedStoreHook,
  type AnyAirJamAgentContract,
} from "@air-jam/sdk";
import { resolveAirJamAgentActionPayload } from "@air-jam/sdk/agent-tooling";
import {
  Fragment,
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  bridgeAction,
  defineVisualHarnessBridge,
  describeVisualHarnessActions,
  type AnyVisualHarnessBridgeDefinition,
  type InferVisualHarnessBridgeActions,
  type InferVisualHarnessBridgeContext,
} from "../core/bridge-contract.js";
import {
  clearVisualHarnessBridgeActions,
  clearVisualHarnessBridgeSnapshot,
  publishVisualHarnessBridgeActions,
  publishVisualHarnessBridgeSnapshot,
  readVisualHarnessBridgeSnapshot,
  type PublishedVisualHarnessBridgeSnapshot,
  VISUAL_HARNESS_AGENT_HOST_ACTION_PREFIX,
  VISUAL_HARNESS_ENABLE_PARAM,
  VISUAL_HARNESS_ENABLE_VALUE,
} from "../core/runtime-bridge.js";
import type { DevHarnessSnapshotAfterStatus } from "../core/dev-control.js";
import { VisualHarnessDevControlClient } from "./dev-control-client.js";

type VisualHarnessDevWindow = Window & {
  __airJamDevProviderMountSent__?: boolean;
};

const isVisualHarnessRuntimeEnabled = (): boolean => {
  if (typeof window !== "undefined") {
    const explicitlyEnabled =
      new URLSearchParams(window.location.search).get(
        VISUAL_HARNESS_ENABLE_PARAM,
      ) === VISUAL_HARNESS_ENABLE_VALUE;
    if (explicitlyEnabled) {
      return true;
    }

    const topology = readRuntimeTopologyFromWindow(window as unknown as object);
    if (topology) {
      return isLocalDevControlSurfaceTopology(topology);
    }
  }

  try {
    const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
    if (meta?.env?.DEV === true) {
      return true;
    }
  } catch {
    // Fall through to the explicit URL opt-in below.
  }

  if (typeof window === "undefined") {
    return false;
  }

  const devWindow = window as VisualHarnessDevWindow;
  if (devWindow.__airJamDevProviderMountSent__ === true) {
    return true;
  }

  return false;
};

type UseVisualHarnessRuntimeOptions = {
  enabled?: boolean;
};

type CommittedSnapshotObservation = {
  snapshot: PublishedVisualHarnessBridgeSnapshot | null;
  status: DevHarnessSnapshotAfterStatus;
};

type VisualHarnessHostActionDispatcher = (
  ...args: never[]
) => Promise<unknown>;

type AnyVisualHarnessSyncedStoreHook =
  // Existential wildcard for arbitrary synced store shapes bound into the visual runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AirJamSyncedStoreHook<any>;

export type VisualHarnessAgentRuntimeBinding = {
  contract: AnyAirJamAgentContract;
  stores: Record<string, AnyVisualHarnessSyncedStoreHook>;
};

export type VisualHarnessRuntimeProps<
  TBridge extends AnyVisualHarnessBridgeDefinition,
> = {
  gameId: string;
  agent?: VisualHarnessAgentRuntimeBinding | null;
  bridge: TBridge;
  context: InferVisualHarnessBridgeContext<TBridge>;
  enabled?: boolean;
};

type PublishedHostAgentActionMap = Record<
  string,
  (payload?: unknown) => Promise<unknown>
>;

const createPublishedActionMap = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>(
  gameId: string,
  bridge: TBridge,
  contextRef: MutableRefObject<InferVisualHarnessBridgeContext<TBridge>>,
) => {
  const actionEntries = Object.entries(bridge.actions).map(
    ([actionName, actionDefinition]) => {
      const publishedAction = async (payload?: unknown) => {
        const nextPayload = actionDefinition.parse(payload, {
          gameId,
          actionName,
        });

        return actionDefinition.run(contextRef.current, nextPayload);
      };

      return [actionName, publishedAction] as const;
    },
  );

  return Object.fromEntries(actionEntries) as {
    [K in keyof InferVisualHarnessBridgeActions<TBridge>]: (
      payload?: unknown,
    ) => Promise<unknown>;
  };
};

const createPublishedHostAgentActionMap = ({
  gameId,
  agent,
  boundAgentStoreActionDispatchersRef,
}: {
  gameId: string;
  agent?: VisualHarnessAgentRuntimeBinding | null;
  boundAgentStoreActionDispatchersRef: MutableRefObject<
    Record<string, Record<string, VisualHarnessHostActionDispatcher>>
  >;
}): PublishedHostAgentActionMap => {
  if (!agent) {
    return {};
  }

  const actionEntries = Object.entries(agent.contract.actions)
    .filter(([, action]) => action.target.kind === "host")
    .map(([actionId, action]) => {
      const actionName = `${VISUAL_HARNESS_AGENT_HOST_ACTION_PREFIX}${actionId}`;
      const publishedAction = async (payload?: unknown) => {
        const storeDomain = action.target.storeDomain ?? "default";
        const storeDispatch =
          boundAgentStoreActionDispatchersRef.current[storeDomain];
        const dispatcher = storeDispatch?.[action.target.actionName];
        if (typeof dispatcher !== "function") {
          throw new Error(
            `Missing host action dispatcher for semantic agent action "${actionId}" on store "${storeDomain}".`,
          );
        }

        const resolvedPayload = resolveAirJamAgentActionPayload(action, payload, {
          gameId,
          actionName: actionId,
          contractKind: "agent",
        });
        const invokeDispatcher = dispatcher as (
          payload?: unknown,
        ) => Promise<unknown>;

        if (action.input.metadata.payload.kind === "none") {
          return invokeDispatcher();
        }

        return invokeDispatcher(resolvedPayload);
      };

      return [actionName, publishedAction] as const;
    });

  return Object.fromEntries(actionEntries);
};

const useVisualHarnessRuntime = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>(
  gameId: string,
  agent: VisualHarnessAgentRuntimeBinding | null | undefined,
  boundAgentStoreActionDispatchersRef: MutableRefObject<
    Record<string, Record<string, VisualHarnessHostActionDispatcher>>
  >,
  bridge: TBridge,
  context: InferVisualHarnessBridgeContext<TBridge>,
  options?: UseVisualHarnessRuntimeOptions,
): void => {
  const enabled = options?.enabled ?? isVisualHarnessRuntimeEnabled();
  const contextRef = useRef(context);
  contextRef.current = context;
  const snapshotRef = useRef<PublishedVisualHarnessBridgeSnapshot | null>(null);
  const snapshotWaitersRef = useRef<
    Array<{
      previousUpdatedAt: string | null;
      resolve: (snapshot: PublishedVisualHarnessBridgeSnapshot | null) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }>
  >([]);

  const publishedActions = useMemo(
    () => createPublishedActionMap(gameId, bridge, contextRef),
    [bridge, gameId],
  );
  const publishedHostAgentActions = useMemo(
    () =>
      createPublishedHostAgentActionMap({
        gameId,
        agent,
        boundAgentStoreActionDispatchersRef,
      }),
    [agent, gameId, boundAgentStoreActionDispatchersRef],
  );
  const devControlClientRef = useRef<VisualHarnessDevControlClient | null>(
    null,
  );

  const resolveSnapshotWaiters = (
    snapshot: PublishedVisualHarnessBridgeSnapshot | null,
  ) => {
    const nextPending: typeof snapshotWaitersRef.current = [];
    for (const waiter of snapshotWaitersRef.current) {
      if (
        waiter.previousUpdatedAt === null ||
        snapshot?.updatedAt !== waiter.previousUpdatedAt
      ) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(snapshot);
        continue;
      }

      nextPending.push(waiter);
    }

    snapshotWaitersRef.current = nextPending;
  };

  const waitForCommittedSnapshot = (previousUpdatedAt: string | null) =>
    new Promise<CommittedSnapshotObservation>((resolve) => {
        const currentSnapshot = snapshotRef.current;
        if (
          previousUpdatedAt === null ||
          currentSnapshot?.updatedAt !== previousUpdatedAt
        ) {
          resolve({
            snapshot: currentSnapshot,
            status: "committed-update-observed",
          });
          return;
        }

        const timeoutId = setTimeout(() => {
          snapshotWaitersRef.current = snapshotWaitersRef.current.filter(
            (waiter) => waiter.timeoutId !== timeoutId,
          );
          resolve({
            snapshot: snapshotRef.current,
            status: "no-new-commit-before-timeout",
          });
        }, 1_500);

        snapshotWaitersRef.current.push({
          previousUpdatedAt,
          resolve: (snapshot) =>
            resolve({
              snapshot,
              status: "committed-update-observed",
            }),
          timeoutId,
        });
      });

  if (!devControlClientRef.current) {
    devControlClientRef.current = new VisualHarnessDevControlClient({
      gameId,
      readSnapshot: () => snapshotRef.current,
      waitForCommittedSnapshot,
      listActions: () => describeVisualHarnessActions(bridge.actions),
      invokeAction: (actionName, payload) => {
        const action =
          publishedActions[actionName] ?? publishedHostAgentActions[actionName];
        if (typeof action !== "function") {
          throw new Error(`Missing harness action "${actionName}".`);
        }
        return action(payload);
      },
    });
  }

  useLayoutEffect(() => {
    if (!enabled) {
      snapshotRef.current = null;
      resolveSnapshotWaiters(null);
      clearVisualHarnessBridgeSnapshot();
      devControlClientRef.current?.stop();
      return;
    }

    publishVisualHarnessBridgeSnapshot(bridge.selectSnapshot(context));
    snapshotRef.current =
      readVisualHarnessBridgeSnapshot<PublishedVisualHarnessBridgeSnapshot>(
        globalThis,
      );
    resolveSnapshotWaiters(snapshotRef.current);
    devControlClientRef.current?.start();
    devControlClientRef.current?.sync();
  });

  useEffect(() => {
    if (!enabled) {
      clearVisualHarnessBridgeActions();
      return;
    }

    publishVisualHarnessBridgeActions({
      ...publishedActions,
      ...publishedHostAgentActions,
    });
    return () => {
      clearVisualHarnessBridgeActions();
    };
  }, [enabled, publishedActions, publishedHostAgentActions]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return () => {
      devControlClientRef.current?.stop();
      snapshotRef.current = null;
      resolveSnapshotWaiters(null);
      for (const waiter of snapshotWaitersRef.current) {
        clearTimeout(waiter.timeoutId);
        waiter.resolve(null);
      }
      snapshotWaitersRef.current = [];
      clearVisualHarnessBridgeSnapshot();
      clearVisualHarnessBridgeActions();
    };
  }, [enabled]);
};

export const VisualHarnessRuntime = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>({
  gameId,
  agent,
  bridge,
  context,
  enabled,
}: VisualHarnessRuntimeProps<TBridge>) => {
  const boundAgentStoreActionDispatchersRef = useRef<
    Record<string, Record<string, VisualHarnessHostActionDispatcher>>
  >({});
  const bindHostActionStore = useCallback(
    (
      storeDomain: string,
      actions: Record<string, VisualHarnessHostActionDispatcher>,
    ) => {
      boundAgentStoreActionDispatchersRef.current[storeDomain] = actions;
    },
    [],
  );
  const unbindHostActionStore = useCallback((storeDomain: string) => {
    delete boundAgentStoreActionDispatchersRef.current[storeDomain];
  }, []);

  useVisualHarnessRuntime(
    gameId,
    agent,
    boundAgentStoreActionDispatchersRef,
    bridge,
    context,
    {
      enabled,
    },
  );

  return agent
    ? createElement(VisualHarnessAgentStoreBindings, {
        stores: agent.stores,
        bindHostActionStore,
        unbindHostActionStore,
      })
    : null;
};

export { bridgeAction, defineVisualHarnessBridge };

const VisualHarnessAgentStoreBinding = ({
  storeDomain,
  store,
  bindHostActionStore,
  unbindHostActionStore,
}: {
  storeDomain: string;
  store: AnyVisualHarnessSyncedStoreHook;
  bindHostActionStore: (
    storeDomain: string,
    actions: Record<string, VisualHarnessHostActionDispatcher>,
  ) => void;
  unbindHostActionStore: (storeDomain: string) => void;
}) => {
  const actions = store.useActions();

  useEffect(() => {
    bindHostActionStore(
      storeDomain,
      actions as unknown as Record<string, VisualHarnessHostActionDispatcher>,
    );
    return () => {
      unbindHostActionStore(storeDomain);
    };
  }, [actions, bindHostActionStore, storeDomain, unbindHostActionStore]);

  return null;
};

const VisualHarnessAgentStoreBindings = ({
  stores,
  bindHostActionStore,
  unbindHostActionStore,
}: {
  stores: Record<string, AnyVisualHarnessSyncedStoreHook>;
  bindHostActionStore: (
    storeDomain: string,
    actions: Record<string, VisualHarnessHostActionDispatcher>,
  ) => void;
  unbindHostActionStore: (storeDomain: string) => void;
}) => (
  createElement(
    Fragment,
    null,
    ...Object.entries(stores).map(([storeDomain, store]) =>
      createElement(VisualHarnessAgentStoreBinding, {
        key: storeDomain,
        storeDomain,
        store,
        bindHostActionStore,
        unbindHostActionStore,
      }),
    ),
  )
);
