import type { RuntimeKind } from "../contracts/v2";
import type { AirJamDevLogEventName } from "../protocol";

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
