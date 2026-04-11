import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import {
  bridgeAction,
  defineVisualHarnessBridge,
  type AnyVisualHarnessBridgeDefinition,
  type InferVisualHarnessBridgeActions,
  type InferVisualHarnessBridgeContext,
} from "./bridge-contract.js";
import {
  clearVisualHarnessBridgeActions,
  clearVisualHarnessBridgeSnapshot,
  publishVisualHarnessBridgeActions,
  publishVisualHarnessBridgeSnapshot,
} from "./runtime-bridge.js";

const isVisualHarnessRuntimeEnabled = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    return meta?.env?.DEV === true;
  } catch {
    return false;
  }
};

type UseVisualHarnessBridgeOptions = {
  enabled?: boolean;
};

const createPublishedActionMap = <TBridge extends AnyVisualHarnessBridgeDefinition>(
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

export const useVisualHarnessBridge = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
>(
  bridge: TBridge,
  context: InferVisualHarnessBridgeContext<TBridge>,
  options?: UseVisualHarnessBridgeOptions,
): void => {
  const enabled = options?.enabled ?? isVisualHarnessRuntimeEnabled();
  const contextRef = useRef(context);
  contextRef.current = context;

  const publishedActions = useMemo(
    () => createPublishedActionMap(bridge, contextRef),
    [bridge],
  );

  useEffect(() => {
    if (!enabled) {
      clearVisualHarnessBridgeSnapshot();
      return;
    }

    publishVisualHarnessBridgeSnapshot(bridge.selectSnapshot(context));
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
      clearVisualHarnessBridgeSnapshot();
      clearVisualHarnessBridgeActions();
    };
  }, [enabled]);
};

export { bridgeAction, defineVisualHarnessBridge };
