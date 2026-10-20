import type { AirJamDevRuntimeEventDetail } from "../core/dev-events";

export type {
  AirJamDevRuntimeEventDetail,
  AirJamDevRuntimeLogLevel,
} from "../core/dev-events";

export const AIRJAM_DEV_LOG_SINK_FAILURE = "AIRJAM_DEV_LOG_SINK_FAILURE";
export const AIRJAM_DEV_PROVIDER_MOUNTED = "AIRJAM_DEV_PROVIDER_MOUNTED";
export const AIRJAM_DEV_RUNTIME_EVENT = "AIRJAM_DEV_RUNTIME_EVENT";

export const emitAirJamDevRuntimeEvent = (
  detail: AirJamDevRuntimeEventDetail,
): void => {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AirJamDevRuntimeEventDetail>(AIRJAM_DEV_RUNTIME_EVENT, {
      detail,
    }),
  );
};
