export type AirJamDiagnosticSeverity = "warn" | "error";

export type AirJamDiagnosticCode =
  | "AJ_SCOPE_MISMATCH"
  | "AJ_MISSING_SESSION_PROVIDER"
  | "AJ_CONFIG_MISSING_SERVER_URL"
  | "AJ_CONFIG_MISSING_API_KEY"
  | "AJ_STORE_ACTION_SESSION_NOT_READY"
  | "AJ_STORE_ACTION_SOCKET_DISCONNECTED"
  | "AJ_STORE_ACTION_EVENT_PAYLOAD_DROPPED"
  | "AJ_STORE_ACTION_PAYLOAD_NOT_SERIALIZABLE"
  | "AJ_INPUT_WRITER_INVALID_SHAPE"
  | "AJ_INPUT_WRITER_NOT_SERIALIZABLE"
  | "AJ_INPUT_WRITER_SESSION_NOT_READY"
  | "AJ_INPUT_WRITER_SOCKET_DISCONNECTED"
  | "AJ_INPUT_WRITER_SCHEMA_INVALID";

export interface AirJamDiagnostic {
  code: AirJamDiagnosticCode;
  severity: AirJamDiagnosticSeverity;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

type AirJamDiagnosticInput = Omit<AirJamDiagnostic, "timestamp">;
type AirJamDiagnosticListener = (diagnostic: AirJamDiagnostic) => void;

const listeners = new Set<AirJamDiagnosticListener>();
const lastEmissionByKey = new Map<string, number>();
const DIAGNOSTIC_THROTTLE_MS = 1500;

let diagnosticsEnabledOverride: boolean | null = null;

const shouldEmitDiagnostics = (): boolean => {
  if (diagnosticsEnabledOverride !== null) {
    return diagnosticsEnabledOverride;
  }

  const nodeEnv = (
    globalThis as {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;
  if (typeof nodeEnv === "string") {
    return nodeEnv !== "production";
  }

  return true;
};

const toConsolePrefix = (code: AirJamDiagnosticCode): string =>
  `[AirJam][${code}]`;

export const emitAirJamDiagnostic = (input: AirJamDiagnosticInput): void => {
  if (!shouldEmitDiagnostics()) {
    return;
  }

  const now = Date.now();
  const key = `${input.code}|${input.message}`;
  const last = lastEmissionByKey.get(key);
  if (last && now - last < DIAGNOSTIC_THROTTLE_MS) {
    return;
  }
  lastEmissionByKey.set(key, now);

  const diagnostic: AirJamDiagnostic = {
    ...input,
    timestamp: now,
  };

  for (const listener of listeners) {
    listener(diagnostic);
  }

  const logger = input.severity === "error" ? console.error : console.warn;
  if (input.details) {
    logger(`${toConsolePrefix(input.code)} ${input.message}`, input.details);
    return;
  }
  logger(`${toConsolePrefix(input.code)} ${input.message}`);
};

export const onAirJamDiagnostic = (
  listener: AirJamDiagnosticListener,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setAirJamDiagnosticsEnabled = (enabled: boolean): void => {
  diagnosticsEnabledOverride = enabled;
};

export const createAirJamDiagnosticError = (
  code: AirJamDiagnosticCode,
  message: string,
  details?: Record<string, unknown>,
): Error => {
  emitAirJamDiagnostic({
    code,
    severity: "error",
    message,
    details,
  });
  const error = new Error(`${toConsolePrefix(code)} ${message}`);
  Object.defineProperty(error, "code", {
    value: code,
    enumerable: true,
  });
  return error;
};

export const resetAirJamDiagnosticsForTests = (): void => {
  listeners.clear();
  lastEmissionByKey.clear();
  diagnosticsEnabledOverride = null;
};
