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
    const currentFilter = filter;
    return subscribeToRuntimeObservability((event) => {
      handlerRef.current(event);
    }, currentFilter);
  }, [filter]);
};
