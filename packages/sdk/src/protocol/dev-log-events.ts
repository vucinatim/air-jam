export type AirJamDevBrowserLogSource =
  | "console"
  | "window-error"
  | "unhandledrejection"
  | "diagnostic"
  | "runtime";

export type AirJamDevBrowserConsoleCategory =
  | "airjam"
  | "app"
  | "framework"
  | "browser";

const describeBrowserConsoleValue = (value: unknown): string => {
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

const matchesAnyPrefix = (value: string, prefixes: string[]): boolean => {
  return prefixes.some((prefix) => value.startsWith(prefix));
};

export const resolveAirJamBrowserConsoleCategory = (
  value: string | unknown[],
): AirJamDevBrowserConsoleCategory => {
  const message =
    typeof value === "string"
      ? value
      : value.map((entry) => describeBrowserConsoleValue(entry)).join(" ");
  const firstText =
    typeof value === "string"
      ? value
      : typeof value[0] === "string"
        ? value[0]
        : "";

  if (
    matchesAnyPrefix(message, [
      "[AirJam]",
      "[Arcade]",
      "[GamePlayer]",
      "[Arcade][AJ_",
    ]) ||
    matchesAnyPrefix(firstText, [
      "[AirJam]",
      "[Arcade]",
      "[GamePlayer]",
      "[Arcade][AJ_",
    ])
  ) {
    return "airjam";
  }

  if (
    matchesAnyPrefix(firstText, ["%c >> query", "%c << query"]) ||
    message.startsWith("[Fast Refresh]") ||
    message.includes("Download the React DevTools") ||
    message.includes("No routes matched location") ||
    message.startsWith("Warning:")
  ) {
    return "framework";
  }

  if (
    message.includes("Largest Contentful Paint") ||
    message.startsWith('Image with src "') ||
    message.includes("ResizeObserver loop")
  ) {
    return "browser";
  }

  return "app";
};

export const AIRJAM_DEV_LOG_EVENTS = {
  server: {
    started: "server.started",
    startupFailed: "server.startup.failed",
  },
  auth: {
    modeDisabled: "auth.mode.disabled",
    modeMasterKey: "auth.mode.master_key",
  },
  browser: {
    logSessionStarted: "browser.log_session.started",
    logBatchReceived: "browser.log_batch.received",
    console: "browser.console",
    windowError: "browser.window_error",
    unhandledRejection: "browser.unhandled_rejection",
    diagnostic: "browser.diagnostic",
    runtime: "browser.runtime",
  },
  runtime: {
    providerMounted: "runtime.provider.mounted",
    providerUnmounted: "runtime.provider.unmounted",
    windowBeforeUnload: "runtime.window.beforeunload",
    windowPageHide: "runtime.window.pagehide",
    roomStatus: "runtime.room.status",
    hostResetRoomRequested: "runtime.host.reset_room.requested",
    clipCaptureFailed: "runtime.host.clip_capture_failed",
    hostFrameFault: "runtime.host.frame_fault",
    errorReport: "runtime.error_report",
    phaseTransition: "runtime.phase.transition",
    embeddedBridgeRequested: "runtime.embedded_bridge.requested",
    embeddedBridgeRejected: "runtime.embedded_bridge.rejected",
    browserLogSinkFailure: "runtime.browser_log_sink.failure",
  },
  host: {
    stateRestoreDiscarded: "host.state_restore.discarded",
  },
} as const;

type ValueOf<T> = T[keyof T];

export type AirJamDevLogEventName = ValueOf<{
  [Group in keyof typeof AIRJAM_DEV_LOG_EVENTS]: ValueOf<
    (typeof AIRJAM_DEV_LOG_EVENTS)[Group]
  >;
}>;

const AIRJAM_BROWSER_LOG_EVENT_BY_SOURCE = {
  console: AIRJAM_DEV_LOG_EVENTS.browser.console,
  "window-error": AIRJAM_DEV_LOG_EVENTS.browser.windowError,
  unhandledrejection: AIRJAM_DEV_LOG_EVENTS.browser.unhandledRejection,
  diagnostic: AIRJAM_DEV_LOG_EVENTS.browser.diagnostic,
  runtime: AIRJAM_DEV_LOG_EVENTS.browser.runtime,
} as const satisfies Record<AirJamDevBrowserLogSource, AirJamDevLogEventName>;

export const resolveAirJamBrowserLogEvent = (
  source: AirJamDevBrowserLogSource,
): AirJamDevLogEventName => AIRJAM_BROWSER_LOG_EVENT_BY_SOURCE[source];
