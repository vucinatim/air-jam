import type { AirJamDevLogEventName } from "@air-jam/sdk/protocol";
import type { ServerLogger } from "./logger.js";

interface SummaryEntry {
  bindings: Record<string, unknown>;
  data: Record<string, unknown>;
  metrics: Record<string, number>;
  startedAt: number;
  lastAt: number;
  timer: ReturnType<typeof setTimeout>;
}

export interface WindowedEventSummaryRecord {
  key: string;
  bindings?: Record<string, unknown>;
  data?: Record<string, unknown>;
  metrics?: Record<string, number>;
}

export interface WindowedEventSummaryLogger {
  record: (entry: WindowedEventSummaryRecord) => void;
  flushAll: () => void;
}

export interface WindowedEventSummaryPayload {
  key: string;
  bindings: Record<string, unknown>;
  data: Record<string, unknown>;
}

const DEFAULT_SUMMARY_WINDOW_MS = 5000;
const SUMMARY_ENABLED = process.env.NODE_ENV !== "production";

const resolveSummaryWindowMs = (): number => {
  const raw = process.env.AIR_JAM_DEV_LOG_SUMMARY_WINDOW_MS;
  if (!raw) {
    return DEFAULT_SUMMARY_WINDOW_MS;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SUMMARY_WINDOW_MS;
};

const mergeMetrics = (
  target: Record<string, number>,
  next: Record<string, number> | undefined,
): void => {
  if (!next) {
    return;
  }

  for (const [name, value] of Object.entries(next)) {
    if (!Number.isFinite(value)) {
      continue;
    }
    target[name] = (target[name] ?? 0) + value;
  }
};

export const createWindowedEventSummary = ({
  logger,
  event,
  msg,
  windowMs = resolveSummaryWindowMs(),
  shouldEmit,
}: {
  logger: ServerLogger;
  event: AirJamDevLogEventName;
  msg: string;
  windowMs?: number;
  shouldEmit?: (
    next: WindowedEventSummaryPayload,
    previous: WindowedEventSummaryPayload | undefined,
  ) => boolean;
}): WindowedEventSummaryLogger => {
  if (!SUMMARY_ENABLED) {
    return {
      record: () => undefined,
      flushAll: () => undefined,
    };
  }

  const entries = new Map<string, SummaryEntry>();
  const lastEmitted = new Map<string, WindowedEventSummaryPayload>();

  const flush = (key: string): void => {
    const entry = entries.get(key);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timer);
    entries.delete(key);

    const payload: WindowedEventSummaryPayload = {
      key,
      bindings: entry.bindings,
      data: {
        ...entry.data,
        ...entry.metrics,
        durationMs: Math.max(entry.lastAt - entry.startedAt, 0),
        windowMs,
      },
    };

    const previous = lastEmitted.get(key);
    if (shouldEmit && !shouldEmit(payload, previous)) {
      return;
    }

    logger.info(
      {
        event,
        ...payload.bindings,
        data: payload.data,
      },
      msg,
    );
    lastEmitted.set(key, payload);
  };

  const record = ({
    key,
    bindings = {},
    data = {},
    metrics = { count: 1 },
  }: WindowedEventSummaryRecord): void => {
    const now = Date.now();
    const existing = entries.get(key);
    if (existing) {
      existing.bindings = {
        ...existing.bindings,
        ...bindings,
      };
      existing.data = {
        ...existing.data,
        ...data,
      };
      existing.lastAt = now;
      mergeMetrics(existing.metrics, metrics);
      return;
    }

    const timer = setTimeout(() => {
      flush(key);
    }, windowMs);
    timer.unref?.();

    const nextEntry: SummaryEntry = {
      bindings,
      data,
      metrics: {},
      startedAt: now,
      lastAt: now,
      timer,
    };
    mergeMetrics(nextEntry.metrics, metrics);
    entries.set(key, nextEntry);
  };

  return {
    record,
    flushAll: () => {
      for (const key of Array.from(entries.keys())) {
        flush(key);
      }
    },
  };
};
