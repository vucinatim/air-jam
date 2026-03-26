import {
  onAirJamDiagnostic,
  type AirJamDiagnostic,
  type AirJamDiagnosticSeverity,
} from "../diagnostics";
import { AIRJAM_DEV_LOG_SINK_FAILURE } from "../runtime/dev-runtime-events";

type BrowserLogLevel = "debug" | "info" | "warn" | "error";
type BrowserLogSource =
  | "console"
  | "window-error"
  | "unhandledrejection"
  | "diagnostic";

interface BrowserLogEntry {
  time: string;
  level: BrowserLogLevel;
  source: BrowserLogSource;
  message: string;
  data?: unknown[];
  stack?: string;
  code?: string;
}

interface BrowserLogBatchPayload {
  mode: "reset" | "append";
  sessionId: string;
  metadata: {
    appId?: string;
    traceId?: string;
    origin?: string;
    pathname?: string;
    href?: string;
    title?: string;
    userAgent?: string;
  };
  entries: BrowserLogEntry[];
}

type ConsoleMethodName = "debug" | "info" | "log" | "warn" | "error";

interface BrowserLogSinkOptions {
  serverUrl?: string;
  appId?: string;
}

interface BrowserLogSinkController {
  update: (options: BrowserLogSinkOptions) => void;
}

interface BrowserLogSinkGlobal {
  __airJamBrowserLogSink__?: BrowserLogSinkController;
  __airJamHostTraceId__?: string;
}

const FLUSH_INTERVAL_MS = 200;

const resolveNodeEnvMode = (): string | undefined => {
  return (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.NODE_ENV;
};

const resolveImportMetaDev = (): boolean | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    if (meta?.env && typeof meta.env.DEV === "boolean") {
      return meta.env.DEV;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const isDevelopmentRuntime = (): boolean => {
  const importMetaDev = resolveImportMetaDev();
  if (typeof importMetaDev === "boolean") {
    return importMetaDev;
  }

  return resolveNodeEnvMode() !== "production";
};

const normalizeServerUrlToHttp = (serverUrl: string): string => {
  if (serverUrl.startsWith("ws://")) {
    return `http://${serverUrl.slice(5)}`;
  }
  if (serverUrl.startsWith("wss://")) {
    return `https://${serverUrl.slice(6)}`;
  }
  return serverUrl;
};

const resolveLogEndpoint = (serverUrl?: string): string | null => {
  if (!serverUrl) {
    return null;
  }

  const baseUrl = normalizeServerUrlToHttp(serverUrl).replace(/\/$/, "");
  return `${baseUrl}/__airjam/dev/browser-logs`;
};

const resolveLogLevelFromDiagnostic = (
  severity: AirJamDiagnosticSeverity,
): BrowserLogLevel => {
  return severity === "error" ? "error" : "warn";
};

const resolveConsoleLevel = (methodName: ConsoleMethodName): BrowserLogLevel => {
  switch (methodName) {
    case "debug":
      return "debug";
    case "info":
    case "log":
      return "info";
    case "warn":
      return "warn";
    case "error":
      return "error";
  }
};

const describeUnknown = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const toSerializable = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return describeUnknown(value);
  }
};

const buildConsoleMessage = (args: unknown[]): string => {
  if (args.length === 0) {
    return "(empty console call)";
  }
  return args.map((arg) => describeUnknown(arg)).join(" ");
};

const createSessionId = (): string => {
  const cryptoLike = globalThis.crypto as
    | { randomUUID?: () => string }
    | undefined;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }
  return `airjam-browser-${Date.now().toString(36)}`;
};

class BrowserLogSinkRuntime {
  private endpoint: string | null = null;
  private appId: string | undefined;
  private readonly sessionId = createSessionId();
  private readonly queue: BrowserLogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private hasReset = false;
  private readonly originalConsole = new Map<ConsoleMethodName, Console[ConsoleMethodName]>();

  update(options: BrowserLogSinkOptions): void {
    this.endpoint = resolveLogEndpoint(options.serverUrl);
    this.appId = options.appId;
  }

  private reportTransportFailure(
    reason: string,
    details?: Record<string, unknown>,
  ): void {
    const payload = {
      reason,
      endpoint: this.endpoint,
      appId: this.appId,
      origin:
        typeof window !== "undefined" ? window.location.origin : undefined,
      href: typeof window !== "undefined" ? window.location.href : undefined,
      ...details,
    };

    const originalError =
      this.originalConsole.get("error") ?? console.error.bind(console);
    originalError("[AirJam][AJ_BROWSER_LOG_SINK_POST_FAILED]", payload);

    if (
      typeof window !== "undefined" &&
      window.parent &&
      window.parent !== window
    ) {
      try {
        window.parent.postMessage(
          {
            type: AIRJAM_DEV_LOG_SINK_FAILURE,
            payload,
          },
          "*",
        );
      } catch {
        // Best effort only
      }
    }
  }

  install(): void {
    if (typeof window === "undefined") {
      return;
    }

    const consoleMethods: ConsoleMethodName[] = [
      "debug",
      "info",
      "log",
      "warn",
      "error",
    ];

    for (const methodName of consoleMethods) {
      this.originalConsole.set(methodName, window.console[methodName].bind(window.console));
      const original = window.console[methodName].bind(window.console);
      window.console[methodName] = ((...args: unknown[]) => {
        original(...args);
        this.enqueue({
          time: new Date().toISOString(),
          level: resolveConsoleLevel(methodName),
          source: "console",
          message: buildConsoleMessage(args),
          data: args.map((arg) => toSerializable(arg)),
        });
      }) as Console[ConsoleMethodName];
    }

    window.addEventListener("error", (event) => {
      this.enqueue({
        time: new Date().toISOString(),
        level: "error",
        source: "window-error",
        message: event.message || "Unhandled window error",
        stack:
          event.error instanceof Error
            ? event.error.stack
            : typeof event.filename === "string"
              ? `${event.filename}:${event.lineno}:${event.colno}`
              : undefined,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : describeUnknown(event.reason);
      this.enqueue({
        time: new Date().toISOString(),
        level: "error",
        source: "unhandledrejection",
        message: reason,
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
    });

    onAirJamDiagnostic((diagnostic) => {
      this.enqueue(this.fromDiagnostic(diagnostic));
    });

    window.addEventListener("pagehide", () => {
      void this.flush(true);
    });

    window.addEventListener("beforeunload", () => {
      void this.flush(true);
    });

    this.enqueue({
      time: new Date().toISOString(),
      level: "info",
      source: "console",
      message: "Browser log sink started",
      data: [
        {
          href: window.location.href,
          origin: window.location.origin,
          pathname: window.location.pathname,
        },
      ],
    });
  }

  private fromDiagnostic(diagnostic: AirJamDiagnostic): BrowserLogEntry {
    return {
      time: new Date(diagnostic.timestamp).toISOString(),
      level: resolveLogLevelFromDiagnostic(diagnostic.severity),
      source: "diagnostic",
      message: diagnostic.message,
      code: diagnostic.code,
      data: diagnostic.details ? [toSerializable(diagnostic.details)] : undefined,
    };
  }

  private enqueue(entry: BrowserLogEntry): void {
    this.queue.push(entry);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  private getMetadata(): BrowserLogBatchPayload["metadata"] {
    if (typeof window === "undefined") {
      return {
        appId: this.appId,
      };
    }

    return {
      appId: this.appId,
      traceId: (globalThis as BrowserLogSinkGlobal).__airJamHostTraceId__,
      origin: window.location.origin,
      pathname: window.location.pathname,
      href: window.location.href,
      title: document.title || undefined,
      userAgent: navigator.userAgent,
    };
  }

  private async flush(useBeacon = false): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (!this.endpoint || this.queue.length === 0) {
      return;
    }

    const payload: BrowserLogBatchPayload = {
      mode: this.hasReset ? "append" : "reset",
      sessionId: this.sessionId,
      metadata: this.getMetadata(),
      entries: this.queue.splice(0, this.queue.length),
    };
    this.hasReset = true;

    let body: string;
    try {
      body = JSON.stringify(payload);
    } catch {
      return;
    }
    if (
      useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(this.endpoint, blob);
      return;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body,
        keepalive: useBeacon,
        mode: "cors",
      });
      if (!response.ok) {
        this.reportTransportFailure(
          `Browser log sink endpoint returned ${response.status}`,
          { status: response.status },
        );
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Unknown browser log sink transport failure";
      this.reportTransportFailure(reason);
    }
  }
}

export const ensureDevBrowserLogSink = (
  options: BrowserLogSinkOptions,
): void => {
  if (typeof window === "undefined" || !isDevelopmentRuntime()) {
    return;
  }

  const globalState = globalThis as BrowserLogSinkGlobal;
  if (!globalState.__airJamBrowserLogSink__) {
    const runtime = new BrowserLogSinkRuntime();
    runtime.update(options);
    runtime.install();
    globalState.__airJamBrowserLogSink__ = {
      update: (nextOptions) => runtime.update(nextOptions),
    };
    return;
  }

  globalState.__airJamBrowserLogSink__.update(options);
};
