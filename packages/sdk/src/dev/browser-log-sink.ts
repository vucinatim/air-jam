import {
  onAirJamDiagnostic,
  type AirJamDiagnostic,
  type AirJamDiagnosticSeverity,
} from "../diagnostics";
import type {
  AirJamDevBrowserConsoleCategory,
  AirJamDevBrowserLogSource,
  AirJamDevLogEventName,
} from "../protocol";
import {
  AIRJAM_DEV_LOG_EVENTS,
  resolveAirJamBrowserConsoleCategory,
} from "../protocol";
import {
  AIRJAM_DEV_LOG_SINK_FAILURE,
  AIRJAM_DEV_RUNTIME_EVENT,
  type AirJamDevRuntimeEventDetail,
} from "../runtime/dev-runtime-events";
import type { ProxyStrategy } from "@air-jam/runtime-topology";

type BrowserLogLevel = "debug" | "info" | "warn" | "error";
type BrowserLogSource = AirJamDevBrowserLogSource;

interface BrowserLogEntry {
  occurredAt: string;
  level: BrowserLogLevel;
  source: BrowserLogSource;
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

interface BrowserLogBatchPayload {
  mode: "reset" | "append";
  sessionId: string;
  metadata: {
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
  };
  entries: BrowserLogEntry[];
}

interface BrowserLogUnloadPayload {
  sessionId: string;
  metadata: BrowserLogBatchPayload["metadata"];
  entry: BrowserLogEntry;
}

type ConsoleMethodName = "debug" | "info" | "log" | "warn" | "error";

interface BrowserLogSinkOptions {
  backendOrigin?: string;
  serverUrl?: string;
  appOrigin?: string;
  proxyStrategy?: ProxyStrategy;
  appId?: string;
}

interface BrowserLogSinkController {
  update: (options: BrowserLogSinkOptions) => void;
  dispose?: () => void;
}

interface BrowserLogSinkGlobal {
  __airJamBrowserLogSink__?: BrowserLogSinkController;
  __airJamHostTraceId__?: string;
  __airJamDevLogContext__?: DevBrowserLogContext;
}

export interface DevBrowserLogContext {
  traceId?: string;
  roomId?: string;
  controllerId?: string;
  role?: "host" | "controller";
}

const FLUSH_INTERVAL_MS = 200;
const CONSOLE_REPEAT_COALESCE_WINDOW_MS = 1000;

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

const resolveEndpointBase = ({
  backendOrigin,
  serverUrl,
  appOrigin,
  proxyStrategy,
}: Pick<
  BrowserLogSinkOptions,
  "backendOrigin" | "serverUrl" | "appOrigin" | "proxyStrategy"
>): string | null => {
  if (proxyStrategy && proxyStrategy !== "none") {
    return (appOrigin ?? resolveDevProxyBaseUrl())?.replace(/\/$/, "") ?? null;
  }

  const explicitOrigin = backendOrigin ?? serverUrl;
  if (!explicitOrigin) {
    return resolveDevProxyBaseUrl();
  }

  if (explicitOrigin.startsWith("ws://")) {
    return `http://${explicitOrigin.slice(5)}`.replace(/\/$/, "");
  }
  if (explicitOrigin.startsWith("wss://")) {
    return `https://${explicitOrigin.slice(6)}`.replace(/\/$/, "");
  }

  return explicitOrigin.replace(/\/$/, "");
};

const resolveDevProxyBaseUrl = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.origin.replace(/\/$/, "");
};

const resolveLogEndpoint = (options: BrowserLogSinkOptions): string | null => {
  const baseUrl = resolveEndpointBase(options);
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl}/__airjam/dev/browser-logs`;
};

const resolveUnloadEndpoint = (options: BrowserLogSinkOptions): string | null => {
  const baseUrl = resolveEndpointBase(options);
  if (!baseUrl) {
    return null;
  }
  return `${baseUrl}/__airjam/dev/browser-unload`;
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

export const resolveBrowserConsoleCategory = (
  args: unknown[],
): AirJamDevBrowserConsoleCategory => {
  return resolveAirJamBrowserConsoleCategory(args);
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

const pruneUndefined = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
};

const resolveDevBrowserLogContext = (): DevBrowserLogContext => {
  const globalState = globalThis as BrowserLogSinkGlobal;
  const explicitContext = globalState.__airJamDevLogContext__;
  if (explicitContext) {
    return explicitContext;
  }

  if (globalState.__airJamHostTraceId__) {
    return {
      traceId: globalState.__airJamHostTraceId__,
    };
  }

  return {};
};

export const updateDevBrowserLogContext = (
  patch: DevBrowserLogContext,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const globalState = globalThis as BrowserLogSinkGlobal;
  const nextValue = pruneUndefined({
    ...resolveDevBrowserLogContext(),
    ...patch,
  });

  if (Object.keys(nextValue).length === 0) {
    delete globalState.__airJamDevLogContext__;
    delete globalState.__airJamHostTraceId__;
    return;
  }

  globalState.__airJamDevLogContext__ = nextValue;
  if (nextValue.traceId) {
    globalState.__airJamHostTraceId__ = nextValue.traceId;
    return;
  }
  delete globalState.__airJamHostTraceId__;
};

class BrowserLogSinkRuntime {
  private endpoint: string | null = null;
  private unloadEndpoint: string | null = null;
  private appId: string | undefined;
  private readonly sessionId = createSessionId();
  private readonly queue: BrowserLogEntry[] = [];
  private nextSourceSeq = 1;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private hasReset = false;
  private readonly originalConsole = new Map<ConsoleMethodName, Console[ConsoleMethodName]>();
  private readonly disposers: Array<() => void> = [];
  private installed = false;

  update(options: BrowserLogSinkOptions): void {
    const previousEndpoint = this.endpoint;
    this.endpoint = resolveLogEndpoint(options);
    this.unloadEndpoint = resolveUnloadEndpoint(options);
    this.appId = options.appId;

    if (
      this.endpoint &&
      this.endpoint !== previousEndpoint &&
      this.queue.length > 0 &&
      !this.flushTimer
    ) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, 0);
    }
  }

  private allocateSourceSeq(explicitSourceSeq?: number): number {
    const sourceSeq = explicitSourceSeq ?? this.nextSourceSeq++;
    if (sourceSeq >= this.nextSourceSeq) {
      this.nextSourceSeq = sourceSeq + 1;
    }
    return sourceSeq;
  }

  private normalizeEntry(entry: BrowserLogEntry): BrowserLogEntry {
    return {
      ...entry,
      sourceSeq: this.allocateSourceSeq(entry.sourceSeq),
    };
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
    if (typeof window === "undefined" || this.installed) {
      return;
    }
    this.installed = true;

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
          occurredAt: new Date().toISOString(),
          level: resolveConsoleLevel(methodName),
          source: "console",
          message: buildConsoleMessage(args),
          consoleCategory: resolveBrowserConsoleCategory(args),
          data: args.map((arg) => toSerializable(arg)),
        });
      }) as Console[ConsoleMethodName];
      this.disposers.push(() => {
        window.console[methodName] = original;
      });
    }

    const errorHandler = (event: ErrorEvent) => {
      this.enqueue({
        occurredAt: new Date().toISOString(),
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
    };
    window.addEventListener("error", errorHandler);
    this.disposers.push(() => {
      window.removeEventListener("error", errorHandler);
    });

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error
          ? event.reason.message
          : describeUnknown(event.reason);
      this.enqueue({
        occurredAt: new Date().toISOString(),
        level: "error",
        source: "unhandledrejection",
        message: reason,
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
    };
    window.addEventListener("unhandledrejection", rejectionHandler);
    this.disposers.push(() => {
      window.removeEventListener("unhandledrejection", rejectionHandler);
    });

    const removeDiagnosticListener = onAirJamDiagnostic((diagnostic) => {
      this.enqueue(this.fromDiagnostic(diagnostic));
    });
    this.disposers.push(removeDiagnosticListener);

    const runtimeEventHandler = (event: Event) => {
      const detail = (event as CustomEvent<AirJamDevRuntimeEventDetail>).detail;
      if (!detail) {
        return;
      }

      this.enqueue(this.fromRuntimeEvent(detail));
    };
    window.addEventListener(AIRJAM_DEV_RUNTIME_EVENT, runtimeEventHandler);
    this.disposers.push(() => {
      window.removeEventListener(AIRJAM_DEV_RUNTIME_EVENT, runtimeEventHandler);
    });

    const pageHideHandler = () => {
      this.emitUnloadEvent(
        {
          occurredAt: new Date().toISOString(),
          level: "info",
          source: "runtime",
          event: AIRJAM_DEV_LOG_EVENTS.runtime.windowPageHide,
          message: "Window pagehide observed",
        },
        { trigger: "pagehide" },
      );
      void this.flush(true);
    };
    window.addEventListener("pagehide", pageHideHandler);
    this.disposers.push(() => {
      window.removeEventListener("pagehide", pageHideHandler);
    });

    const beforeUnloadHandler = () => {
      this.emitUnloadEvent(
        {
          occurredAt: new Date().toISOString(),
          level: "info",
          source: "runtime",
          event: AIRJAM_DEV_LOG_EVENTS.runtime.windowBeforeUnload,
          message: "Window beforeunload observed",
        },
        { trigger: "beforeunload" },
      );
      void this.flush(true);
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    this.disposers.push(() => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    });

    const visibilityChangeHandler = () => {
      if (document.visibilityState !== "hidden") {
        return;
      }

      this.emitUnloadEvent(
        {
          occurredAt: new Date().toISOString(),
          level: "info",
          source: "runtime",
          event: AIRJAM_DEV_LOG_EVENTS.runtime.windowPageHide,
          message: "Document hidden before unload",
        },
        { trigger: "visibilitychange" },
      );
      void this.flush(true);
    };
    document.addEventListener("visibilitychange", visibilityChangeHandler);
    this.disposers.push(() => {
      document.removeEventListener("visibilitychange", visibilityChangeHandler);
    });

    this.enqueue({
      occurredAt: new Date().toISOString(),
      level: "info",
      source: "console",
      message: "Browser log sink started",
      consoleCategory: "airjam",
      data: [
        {
          href: window.location.href,
          origin: window.location.origin,
          pathname: window.location.pathname,
        },
      ],
    });
  }

  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    while (this.disposers.length > 0) {
      const dispose = this.disposers.pop();
      dispose?.();
    }

    this.originalConsole.clear();
    this.installed = false;
  }

  private fromDiagnostic(diagnostic: AirJamDiagnostic): BrowserLogEntry {
    return {
      occurredAt: new Date(diagnostic.timestamp).toISOString(),
      level: resolveLogLevelFromDiagnostic(diagnostic.severity),
      source: "diagnostic",
      message: diagnostic.message,
      code: diagnostic.code,
      data: diagnostic.details ? [toSerializable(diagnostic.details)] : undefined,
    };
  }

  private fromRuntimeEvent(detail: AirJamDevRuntimeEventDetail): BrowserLogEntry {
    return {
      occurredAt: new Date().toISOString(),
      level: detail.level ?? "info",
      source: "runtime",
      event: detail.event,
      message: detail.message,
      code: detail.code,
      role: detail.role,
      traceId: detail.traceId,
      roomId: detail.roomId,
      controllerId: detail.controllerId,
      runtimeEpoch: detail.runtimeEpoch,
      runtimeKind: detail.runtimeKind,
      data: detail.data ? [toSerializable(detail.data)] : undefined,
    };
  }

  private isSameConsolePayload(
    left: BrowserLogEntry["data"],
    right: BrowserLogEntry["data"],
  ): boolean {
    try {
      return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
    } catch {
      return false;
    }
  }

  private shouldCoalesceConsoleEntry(
    previous: BrowserLogEntry | undefined,
    next: BrowserLogEntry,
  ): boolean {
    if (!previous || previous.source !== "console" || next.source !== "console") {
      return false;
    }

    if (next.level !== "warn" && next.level !== "error") {
      return false;
    }

    const previousTime = Date.parse(previous.occurredAt);
    const nextTime = Date.parse(next.occurredAt);
    if (
      Number.isFinite(previousTime) &&
      Number.isFinite(nextTime) &&
      nextTime - previousTime > CONSOLE_REPEAT_COALESCE_WINDOW_MS
    ) {
      return false;
    }

    return (
      previous.level === next.level &&
      previous.message === next.message &&
      previous.consoleCategory === next.consoleCategory &&
      previous.code === next.code &&
      previous.role === next.role &&
      previous.traceId === next.traceId &&
      previous.roomId === next.roomId &&
      previous.controllerId === next.controllerId &&
      this.isSameConsolePayload(previous.data, next.data)
    );
  }

  private appendOrCoalesce(entry: BrowserLogEntry): void {
    const previous = this.queue.at(-1);
    if (this.shouldCoalesceConsoleEntry(previous, entry) && previous) {
      previous.repeatCount = (previous.repeatCount ?? 1) + 1;
      return;
    }

    this.queue.push(entry);
  }

  private enqueue(entry: BrowserLogEntry): void {
    this.appendOrCoalesce(this.normalizeEntry(entry));

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  private buildPayload(entries: BrowserLogEntry[]): BrowserLogBatchPayload {
    return {
      mode: this.hasReset ? "append" : "reset",
      sessionId: this.sessionId,
      metadata: this.getMetadata(),
      entries,
    };
  }

  private serializePayload(payload: unknown): string | null {
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  }

  private async postUnloadPayload(body: string): Promise<void> {
    if (!this.unloadEndpoint) {
      return;
    }

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      try {
        if (navigator.sendBeacon(this.unloadEndpoint, body)) {
          return;
        }
      } catch {
        // Fall through to fetch keepalive transport.
      }
    }

    try {
      const response = await fetch(this.unloadEndpoint, {
        method: "POST",
        headers: {
          "content-type": "text/plain;charset=UTF-8",
        },
        body,
        keepalive: true,
        mode: "cors",
      });
      if (!response.ok) {
        this.reportTransportFailure(
          `Browser unload endpoint returned ${response.status}`,
          { status: response.status, transport: "unload" },
        );
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Unknown browser unload transport failure";
      this.reportTransportFailure(reason, { transport: "unload" });
    }
  }

  private emitUnloadEvent(
    entry: BrowserLogEntry,
    details?: Record<string, unknown>,
  ): void {
    if (!this.unloadEndpoint) {
      return;
    }

    const payload: BrowserLogUnloadPayload = {
      sessionId: this.sessionId,
      metadata: this.getMetadata(),
      entry: this.normalizeEntry({
        ...entry,
        data: details ? [toSerializable(details)] : entry.data,
      }),
    };
    const body = this.serializePayload(payload);
    if (!body) {
      return;
    }

    void this.postUnloadPayload(body);
  }

  private getMetadata(): BrowserLogBatchPayload["metadata"] {
    if (typeof window === "undefined") {
      const devContext = resolveDevBrowserLogContext();
      return {
        appId: this.appId,
        traceId: devContext.traceId,
        roomId: devContext.roomId,
        controllerId: devContext.controllerId,
        role: devContext.role,
      };
    }

    const devContext = resolveDevBrowserLogContext();
    return {
      appId: this.appId,
      traceId: devContext.traceId,
      roomId: devContext.roomId,
      controllerId: devContext.controllerId,
      role: devContext.role,
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

    const entries = [...this.queue];
    const payload = this.buildPayload(entries);
    const body = this.serializePayload(payload);
    if (!body) {
      return;
    }
    this.queue.splice(0, this.queue.length);
    this.hasReset = true;
    await this.postPayload(body, useBeacon);
  }

  private async postPayload(body: string, useBeacon: boolean): Promise<void> {
    if (!this.endpoint) {
      return;
    }

    if (
      useBeacon &&
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      try {
        const requestBody =
          typeof Blob === "function"
            ? new Blob([body], { type: "application/json" })
            : body;
        if (navigator.sendBeacon(this.endpoint, requestBody)) {
          return;
        }
      } catch {
        // Fall through to fetch keepalive transport.
      }
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
      dispose: () => runtime.dispose(),
    };
    return;
  }

  globalState.__airJamBrowserLogSink__.update(options);
};

export const primeDevBrowserLogSink = (
  options: BrowserLogSinkOptions = {},
): void => {
  ensureDevBrowserLogSink(options);
};
