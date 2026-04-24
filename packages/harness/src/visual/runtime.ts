import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
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
  VISUAL_HARNESS_ENABLE_PARAM,
  VISUAL_HARNESS_ENABLE_VALUE,
} from "../core/runtime-bridge.js";
import { VisualHarnessDevControlClient } from "./dev-control-client.js";

type VisualHarnessDevWindow = Window & {
  __airJamDevProviderMountSent__?: boolean;
};

const isVisualHarnessRuntimeEnabled = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
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

  return (
    new URLSearchParams(window.location.search).get(
      VISUAL_HARNESS_ENABLE_PARAM,
    ) === VISUAL_HARNESS_ENABLE_VALUE
  );
};

type UseVisualHarnessRuntimeOptions = {
  enabled?: boolean;
};

export type VisualHarnessRuntimeProps<
  TBridge extends AnyVisualHarnessBridgeDefinition,
> = {
  bridge: TBridge;
  context: InferVisualHarnessBridgeContext<TBridge>;
  enabled?: boolean;
};

const createPublishedActionMap = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>(
  bridge: TBridge,
  contextRef: MutableRefObject<InferVisualHarnessBridgeContext<TBridge>>,
) => {
  const actionEntries = Object.entries(bridge.actions).map(
    ([actionName, actionDefinition]) => {
      const publishedAction = async (payload?: unknown) => {
        const nextPayload = actionDefinition.parse(payload, {
          gameId: bridge.gameId,
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

const useVisualHarnessRuntime = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>(
  bridge: TBridge,
  context: InferVisualHarnessBridgeContext<TBridge>,
  options?: UseVisualHarnessRuntimeOptions,
): void => {
  const enabled = options?.enabled ?? isVisualHarnessRuntimeEnabled();
  const contextRef = useRef(context);
  contextRef.current = context;

  const publishedActions = useMemo(
    () => createPublishedActionMap(bridge, contextRef),
    [bridge],
  );
  const devControlClientRef = useRef<VisualHarnessDevControlClient | null>(
    null,
  );

  if (!devControlClientRef.current) {
    devControlClientRef.current = new VisualHarnessDevControlClient({
      gameId: bridge.gameId,
      readSnapshot: () => readVisualHarnessBridgeSnapshot(globalThis),
      listActions: () => describeVisualHarnessActions(bridge.actions),
      invokeAction: (actionName, payload) => {
        const action = publishedActions[actionName];
        if (typeof action !== "function") {
          throw new Error(`Missing harness action "${actionName}".`);
        }
        return action(payload);
      },
    });
  }

  useEffect(() => {
    if (!enabled) {
      clearVisualHarnessBridgeSnapshot();
      devControlClientRef.current?.stop();
      return;
    }

    publishVisualHarnessBridgeSnapshot(bridge.selectSnapshot(context));
    devControlClientRef.current?.start();
    devControlClientRef.current?.sync();
  });

  useEffect(() => {
    if (!enabled) {
      clearVisualHarnessBridgeActions();
      return;
    }

    publishVisualHarnessBridgeActions(publishedActions);
    return () => {
      clearVisualHarnessBridgeActions();
    };
  }, [enabled, publishedActions]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return () => {
      devControlClientRef.current?.stop();
      clearVisualHarnessBridgeSnapshot();
      clearVisualHarnessBridgeActions();
    };
  }, [enabled]);
};

export const VisualHarnessRuntime = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>({
  bridge,
  context,
  enabled,
}: VisualHarnessRuntimeProps<TBridge>) => {
  useVisualHarnessRuntime(bridge, context, { enabled });
  return null;
};

export { bridgeAction, defineVisualHarnessBridge };
