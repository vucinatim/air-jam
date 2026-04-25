import type { VisualHarnessActionDescriptor } from "./bridge-contract.js";
import type { PublishedVisualHarnessBridgeSnapshot } from "./runtime-bridge.js";

export const DEV_HARNESS_CONTROL_BASE_PATH = "/__airjam/dev/harness";
export const DEV_HARNESS_REGISTER_PATH = `${DEV_HARNESS_CONTROL_BASE_PATH}/register`;
export const DEV_HARNESS_SESSIONS_PATH = `${DEV_HARNESS_CONTROL_BASE_PATH}/sessions`;
export const DEV_HARNESS_COMMANDS_PATH = `${DEV_HARNESS_CONTROL_BASE_PATH}/commands`;
export const DEV_HARNESS_INVOKE_PATH = `${DEV_HARNESS_CONTROL_BASE_PATH}/invoke`;

export type DevHarnessRole = "host" | "controller";

export type DevHarnessActionDescriptor = VisualHarnessActionDescriptor;

export interface DevHarnessSessionRecord {
  sessionId: string;
  gameId: string;
  role: DevHarnessRole;
  roomId: string | null;
  origin: string | null;
  href: string | null;
  title: string | null;
  actions: DevHarnessActionDescriptor[];
  actionNames: string[];
  snapshot: PublishedVisualHarnessBridgeSnapshot | null;
  registeredAt: string;
  lastSeenAt: string;
}

export interface DevHarnessRegisterPayload {
  sessionId: string;
  gameId: string;
  role: DevHarnessRole;
  roomId: string | null;
  origin: string | null;
  href: string | null;
  title: string | null;
  actions: DevHarnessActionDescriptor[];
  snapshot: PublishedVisualHarnessBridgeSnapshot | null;
}

export interface DevHarnessSessionsResponse {
  sessions: DevHarnessSessionRecord[];
}

export interface DevHarnessCommand {
  commandId: string;
  actionName: string;
  payload?: unknown;
  issuedAt: string;
}

export interface DevHarnessCommandResultError {
  message: string;
}

export interface DevHarnessCommandResultPayload {
  sessionId: string;
  roomId: string | null;
  gameId: string;
  actionName: string;
  result?: unknown;
  error?: DevHarnessCommandResultError;
  snapshotBefore: PublishedVisualHarnessBridgeSnapshot | null;
  snapshotAfter: PublishedVisualHarnessBridgeSnapshot | null;
}

export interface DevHarnessCompleteCommandPayload {
  commandId: string;
  result: DevHarnessCommandResultPayload;
}

export interface DevHarnessInvokePayload {
  sessionId?: string;
  roomId?: string;
  gameId?: string;
  actionName: string;
  payload?: unknown;
  timeoutMs?: number;
}

export interface DevHarnessInvokeResponse {
  session: DevHarnessSessionRecord;
  invocation: DevHarnessCommandResultPayload & {
    commandId: string;
    completedAt: string;
  };
}
