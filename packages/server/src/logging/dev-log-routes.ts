import type {
  BrowserLogBatchPayload,
  BrowserLogUnloadPayload,
  DevLogCollector,
} from "./dev-log-collector.js";

/** What a development log endpoint answers; no body means an empty response. */
export interface DevLogRouteResponse {
  readonly status: number;
  readonly body?: { readonly ok: boolean; readonly message?: string };
}

const disabled: DevLogRouteResponse = { status: 404, body: { ok: false } };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** `POST /__airjam/dev/browser-logs`: a browser's batch of console and runtime entries. */
export const receiveBrowserLogBatch = (
  collector: DevLogCollector | null,
  payload: unknown,
): DevLogRouteResponse => {
  if (!collector?.enabled) return disabled;
  if (
    !isObject(payload) ||
    (payload.mode !== "reset" && payload.mode !== "append") ||
    typeof payload.sessionId !== "string" ||
    !payload.sessionId ||
    !Array.isArray(payload.entries) ||
    payload.entries.length === 0 ||
    !isObject(payload.metadata)
  )
    return {
      status: 400,
      body: { ok: false, message: "Invalid browser log payload" },
    };
  collector.enqueueBrowserBatch(payload as unknown as BrowserLogBatchPayload);
  return { status: 200, body: { ok: true } };
};

/** `POST /__airjam/dev/browser-unload`: the last entry a closing page sends as a beacon. */
export const receiveBrowserUnload = (
  collector: DevLogCollector | null,
  text: unknown,
): DevLogRouteResponse => {
  if (!collector?.enabled) return disabled;
  const invalid: DevLogRouteResponse = {
    status: 400,
    body: { ok: false, message: "Invalid browser unload payload" },
  };
  if (typeof text !== "string" || text.trim().length === 0) return invalid;
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return invalid;
  }
  if (
    !isObject(payload) ||
    typeof payload.sessionId !== "string" ||
    !payload.sessionId ||
    !isObject(payload.metadata) ||
    !isObject(payload.entry)
  )
    return invalid;
  collector.enqueueBrowserUnload(payload as unknown as BrowserLogUnloadPayload);
  return { status: 204 };
};
