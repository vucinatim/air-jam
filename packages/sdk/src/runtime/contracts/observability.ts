import type { AirJamDevLogEventName } from "../../protocol";
import {
  AIRJAM_DEV_RUNTIME_EVENT,
  type AirJamDevRuntimeEventDetail,
  type AirJamDevRuntimeLogLevel,
} from "../dev-runtime-events";

export interface RuntimeObservabilityFilter {
  events?: readonly AirJamDevLogEventName[];
  levels?: readonly AirJamDevRuntimeLogLevel[];
  role?: "host" | "controller";
  roomId?: string;
  controllerId?: string;
}

export interface RuntimeObservabilityEvent extends AirJamDevRuntimeEventDetail {
  source: "runtime";
  observedAt: string;
}

export type RuntimeObservabilityEventHandler = (
  event: RuntimeObservabilityEvent,
) => void;

const includes = <T>(values: readonly T[] | undefined, candidate: T): boolean =>
  !values || values.includes(candidate);

export const createRuntimeObservabilityEvent = (
  detail: AirJamDevRuntimeEventDetail,
  observedAt = new Date().toISOString(),
): RuntimeObservabilityEvent => ({
  source: "runtime",
  observedAt,
  ...detail,
});

export const matchesRuntimeObservabilityFilter = (
  event: RuntimeObservabilityEvent,
  filter?: RuntimeObservabilityFilter,
): boolean => {
  if (!filter) {
    return true;
  }

  if (!includes(filter.events, event.event)) {
    return false;
  }

  if (event.level && !includes(filter.levels, event.level)) {
    return false;
  }

  if (filter.role && event.role !== filter.role) {
    return false;
  }

  if (filter.roomId && event.roomId !== filter.roomId) {
    return false;
  }

  if (filter.controllerId && event.controllerId !== filter.controllerId) {
    return false;
  }

  return true;
};

export const subscribeToRuntimeObservability = (
  handler: RuntimeObservabilityEventHandler,
  filter?: RuntimeObservabilityFilter,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AirJamDevRuntimeEventDetail>).detail;
    if (!detail) {
      return;
    }

    const normalized = createRuntimeObservabilityEvent(detail);
    if (!matchesRuntimeObservabilityFilter(normalized, filter)) {
      return;
    }

    handler(normalized);
  };

  window.addEventListener(AIRJAM_DEV_RUNTIME_EVENT, listener);
  return () => {
    window.removeEventListener(AIRJAM_DEV_RUNTIME_EVENT, listener);
  };
};
