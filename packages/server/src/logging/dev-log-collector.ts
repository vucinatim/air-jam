import { mkdirSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";

export type DevLogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
export type DevLogSource = "server" | "browser";

export interface BrowserLogEntry {
  time: string;
  level: "debug" | "info" | "warn" | "error";
  source: "console" | "window-error" | "unhandledrejection" | "diagnostic";
  message: string;
  data?: unknown[];
  stack?: string;
  code?: string;
}

export interface BrowserLogSessionMetadata {
  appId?: string;
  traceId?: string;
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

export interface DevLogEvent {
  time: string;
  level: DevLogLevel;
  source: DevLogSource;
  msg: string;
  service?: string;
  component?: string;
  scope?: string;
  traceId?: string;
  roomId?: string;
  socketId?: string;
  socketIdentifier?: string;
  controllerId?: string;
  origin?: string;
  appIdHint?: string;
  code?: string;
  data?: unknown;
  err?: unknown;
  browserSource?: BrowserLogEntry["source"];
  sessionId?: string;
  metadata?: BrowserLogSessionMetadata;
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

const sanitizeServerEvent = (payload: Record<string, unknown>): DevLogEvent => {
  const {
    time,
    level,
    msg,
    err,
    data,
    ...rest
  } = payload;

  return {
    time: typeof time === "string" ? time : new Date().toISOString(),
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

    this.appendEvent({
      time: new Date().toISOString(),
      level: "info",
      source: "browser",
      msg:
        payload.mode === "reset"
          ? "Browser log session started"
          : "Browser log batch received",
      sessionId: payload.sessionId,
      metadata: payload.metadata,
      data: {
        entryCount: payload.entries.length,
        mode: payload.mode,
      },
    });

    for (const entry of payload.entries) {
      this.appendEvent({
        time: entry.time,
        level: entry.level,
        source: "browser",
        browserSource: entry.source,
        msg: entry.message,
        code: entry.code,
        data: entry.data,
        err: entry.stack ? { stack: entry.stack } : undefined,
        traceId: payload.metadata.traceId,
        origin: payload.metadata.origin,
        sessionId: payload.sessionId,
        metadata: payload.metadata,
      });
    }
  }

  private appendEvent(event: DevLogEvent): void {
    const line = toNdjsonLine(event);
    this.writeQueue = this.writeQueue
      .then(() => appendFile(this.latestFilePath, line, "utf8"))
      .catch(() => undefined);
  }
}

