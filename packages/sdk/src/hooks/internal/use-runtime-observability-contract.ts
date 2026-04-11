import { useEffect, useRef } from "react";
import {
  subscribeToRuntimeObservability,
  type RuntimeObservabilityEventHandler,
  type RuntimeObservabilityFilter,
} from "../../runtime/contracts/observability";

export const useRuntimeObservabilitySubscription = (
  handler: RuntimeObservabilityEventHandler,
  filter?: RuntimeObservabilityFilter,
): void => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    return subscribeToRuntimeObservability((event) => {
      handlerRef.current(event);
    }, filter);
  }, [filter?.controllerId, filter?.roomId, filter?.role, filter?.events, filter?.levels]);
};
