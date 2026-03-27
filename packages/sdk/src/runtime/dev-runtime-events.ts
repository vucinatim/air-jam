import type { RuntimeKind } from "../contracts/v2";
import type { AirJamDevLogEventName } from "../protocol";

export const AIRJAM_DEV_LOG_SINK_FAILURE = "AIRJAM_DEV_LOG_SINK_FAILURE";
export const AIRJAM_DEV_PROVIDER_MOUNTED = "AIRJAM_DEV_PROVIDER_MOUNTED";
export const AIRJAM_DEV_RUNTIME_EVENT = "AIRJAM_DEV_RUNTIME_EVENT";

export type AirJamDevRuntimeLogLevel = "info" | "warn" | "error";

export interface AirJamDevRuntimeEventDetail {
  event: AirJamDevLogEventName;
  message: string;
  level?: AirJamDevRuntimeLogLevel;
  code?: string;
  role?: "host" | "controller";
  traceId?: string;
  roomId?: string;
  controllerId?: string;
  runtimeEpoch?: number;
  runtimeKind?: RuntimeKind;
  data?: Record<string, unknown>;
}

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
