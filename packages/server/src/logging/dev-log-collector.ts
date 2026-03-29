import {
  AIRJAM_DEV_LOG_EVENTS,
  resolveAirJamBrowserLogEvent,
  type AirJamDevBrowserConsoleCategory,
  type AirJamDevBrowserLogSource,
  type AirJamDevLogEventName,
} from "@air-jam/sdk/protocol";
import { mkdirSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export type DevLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type DevLogSource = "server" | "browser" | "workspace";

export interface BrowserLogEntry {
  time?: string;
  occurredAt?: string;
  level: "debug" | "info" | "warn" | "error";
  source: AirJamDevBrowserLogSource;
  message: string;
  sourceSeq?: number;
  repeatCount?: number;
  event?: AirJamDevLogEventName;
  data?: unknown[];
  stack?: string;
  code?: string;
  consoleCategory?: AirJamDevBrowserConsoleCategory;
  role?: "host" | "controller";
  traceId?: string;
  roomId?: string;
  controllerId?: string;
  runtimeEpoch?: number;
  runtimeKind?: string;
}

export interface BrowserLogSessionMetadata {
  appId?: string;
  traceId?: string;
  roomId?: string;
  controllerId?: string;
  role?: "host" | "controller";
  origin?: string;
  pathname?: string;
  href?: string;
  title?: string;
  userAgent?: string;
}

export interface BrowserLogBatchPayload {
  mode: "reset" | "append";
  sessionId: string;
  metadata: BrowserLogSessionMetadata;
  entries: BrowserLogEntry[];
}

export interface BrowserLogUnloadPayload {
  sessionId: string;
  metadata: BrowserLogSessionMetadata;
  entry: BrowserLogEntry;
}

export interface DevLogEvent {
  time: string;
  occurredAt: string;
  ingestedAt: string;
  collectorSeq: number;
  level: DevLogLevel;
  source: DevLogSource;
  msg: string;
  sourceSeq?: number;
  event?: AirJamDevLogEventName;
  service?: string;
  component?: string;
  scope?: string;
  role?: "host" | "controller";
  traceId?: string;
  roomId?: string;
  socketId?: string;
  socketIdentifier?: string;
  controllerId?: string;
  origin?: string;
  appIdHint?: string;
  code?: string;
  runtimeEpoch?: number;
  runtimeKind?: string;
  data?: unknown;
  err?: unknown;
  browserSource?: BrowserLogEntry["source"];
  consoleCategory?: AirJamDevBrowserConsoleCategory;
  repeatCount?: number;
  sessionId?: string;
  metadata?: BrowserLogSessionMetadata;
  processName?: string;
  stream?: "stdout" | "stderr";
  tool?: string;
  [key: string]: unknown;
}

const normalizeLevel = (value: unknown): DevLogLevel => {
  if (
    value === "trace" ||
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error" ||
    value === "fatal"
  ) {
    return value;
  }

  return "info";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const toNdjsonLine = (value: unknown): string => `${JSON.stringify(value)}\n`;

type DevLogEventDraft = Omit<DevLogEvent, "collectorSeq" | "ingestedAt"> & {
  ingestedAt?: string;
};

const sanitizeServerEvent = (
  payload: Record<string, unknown>,
): DevLogEventDraft => {
  const {
    time,
    occurredAt,
    level,
    msg,
    err,
    data,
    ...rest
  } = payload;
  const resolvedOccurredAt =
    typeof occurredAt === "string"
      ? occurredAt
      : typeof time === "string"
        ? time
        : new Date().toISOString();

  return {
    time: resolvedOccurredAt,
    occurredAt: resolvedOccurredAt,
    level: normalizeLevel(level),
    source: "server",
    msg: typeof msg === "string" ? msg : "Server event",
    ...(rest as Record<string, unknown>),
    ...(data !== undefined ? { data } : {}),
    ...(err !== undefined ? { err } : {}),
  };
};

export class DevLogCollector {
  readonly enabled: boolean;
  readonly logDir: string;
  readonly latestFilePath: string;
  private writeQueue: Promise<void> = Promise.resolve();
  private nextCollectorSeq = 1;

  constructor(options: {
    enabled: boolean;
    logDir: string;
  }) {
    this.enabled = options.enabled;
    this.logDir = options.logDir;
    this.latestFilePath = path.join(this.logDir, "dev-latest.ndjson");

    if (this.enabled) {
      mkdirSync(this.logDir, { recursive: true });
      writeFileSync(this.latestFilePath, "", "utf8");
    }
  }

  enqueueServerLogLine(line: string): void {
    if (!this.enabled) {
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (!isRecord(parsed)) {
      return;
    }

    this.appendEvent(sanitizeServerEvent(parsed));
  }

  enqueueBrowserBatch(payload: BrowserLogBatchPayload): void {
    if (!this.enabled) {
      return;
    }

    const ingestedAt = new Date().toISOString();

    this.appendEvent({
      time: ingestedAt,
      occurredAt: ingestedAt,
      ingestedAt,
      level: "info",
      source: "browser",
      event:
        payload.mode === "reset"
          ? AIRJAM_DEV_LOG_EVENTS.browser.logSessionStarted
          : AIRJAM_DEV_LOG_EVENTS.browser.logBatchReceived,
      msg:
        payload.mode === "reset"
          ? "Browser log session started"
          : "Browser log batch received",
      role: payload.metadata.role,
      traceId: payload.metadata.traceId,
      roomId: payload.metadata.roomId,
      controllerId: payload.metadata.controllerId,
      sessionId: payload.sessionId,
      metadata: payload.metadata,
      data: {
        entryCount: payload.entries.length,
        mode: payload.mode,
      },
    });

    for (const entry of payload.entries) {
      const occurredAt =
        typeof entry.occurredAt === "string"
          ? entry.occurredAt
          : typeof entry.time === "string"
            ? entry.time
            : ingestedAt;
      this.appendEvent({
        time: occurredAt,
        occurredAt,
        ingestedAt,
        level: entry.level,
        source: "browser",
        sourceSeq: entry.sourceSeq,
        repeatCount: entry.repeatCount,
        event: entry.event ?? resolveAirJamBrowserLogEvent(entry.source),
        browserSource: entry.source,
        consoleCategory: entry.consoleCategory,
        msg: entry.message,
        code: entry.code,
        data: entry.data,
        err: entry.stack ? { stack: entry.stack } : undefined,
        role: entry.role ?? payload.metadata.role,
        traceId: entry.traceId ?? payload.metadata.traceId,
        roomId: entry.roomId ?? payload.metadata.roomId,
        controllerId: entry.controllerId ?? payload.metadata.controllerId,
        runtimeEpoch: entry.runtimeEpoch,
        runtimeKind: entry.runtimeKind,
        origin: payload.metadata.origin,
        sessionId: payload.sessionId,
        metadata: payload.metadata,
      });
    }
  }

  enqueueBrowserUnload(payload: BrowserLogUnloadPayload): void {
    if (!this.enabled) {
      return;
    }

    const ingestedAt = new Date().toISOString();
    const entry = payload.entry;
    const occurredAt =
      typeof entry.occurredAt === "string"
        ? entry.occurredAt
        : typeof entry.time === "string"
          ? entry.time
          : ingestedAt;

    this.appendEvent({
      time: occurredAt,
      occurredAt,
      ingestedAt,
      level: entry.level,
      source: "browser",
      sourceSeq: entry.sourceSeq,
      repeatCount: entry.repeatCount,
      event: entry.event ?? resolveAirJamBrowserLogEvent(entry.source),
      browserSource: entry.source,
      consoleCategory: entry.consoleCategory,
      msg: entry.message,
      code: entry.code,
      data: entry.data,
      err: entry.stack ? { stack: entry.stack } : undefined,
      role: entry.role ?? payload.metadata.role,
      traceId: entry.traceId ?? payload.metadata.traceId,
      roomId: entry.roomId ?? payload.metadata.roomId,
      controllerId: entry.controllerId ?? payload.metadata.controllerId,
      runtimeEpoch: entry.runtimeEpoch,
      runtimeKind: entry.runtimeKind,
      origin: payload.metadata.origin,
      sessionId: payload.sessionId,
      metadata: payload.metadata,
    });
  }

  private appendEvent(event: DevLogEventDraft): void {
    const ingestedAt =
      typeof event.ingestedAt === "string"
        ? event.ingestedAt
        : new Date().toISOString();
    const occurredAt =
      typeof event.occurredAt === "string"
        ? event.occurredAt
        : typeof event.time === "string"
          ? event.time
          : ingestedAt;
    const {
      time: _time,
      occurredAt: _occurredAt,
      ingestedAt: _ingestedAt,
      level: rawLevel,
      source: rawSource,
      msg: rawMsg,
      ...rest
    } = event;
    const level = rawLevel as DevLogLevel;
    const source = rawSource as DevLogSource;
    const msg = rawMsg as string;
    const normalizedEvent: DevLogEvent = {
      ...rest,
      level,
      source,
      msg,
      time: occurredAt,
      occurredAt,
      ingestedAt,
      collectorSeq: this.nextCollectorSeq++,
    };
    const line = toNdjsonLine(normalizedEvent);
    this.writeQueue = this.writeQueue
      .then(() => appendFile(this.latestFilePath, line, "utf8"))
      .catch(() => undefined);
  }
}
