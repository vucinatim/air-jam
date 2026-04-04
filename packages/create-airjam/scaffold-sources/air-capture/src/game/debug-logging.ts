const BOT_LOGGING_STORAGE_KEY = "airjam:prototype:bot-logging";

const isDevelopmentRuntime = (): boolean => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    if (meta?.env && typeof meta.env.DEV === "boolean") {
      return meta.env.DEV;
    }
  } catch {
    // Ignore environments without import.meta
  }

  return false;
};

export const isPrototypeBotLoggingEnabled = (): boolean => {
  if (!isDevelopmentRuntime() || typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(BOT_LOGGING_STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
};

export const setPrototypeBotLoggingEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (enabled) {
      window.localStorage.setItem(BOT_LOGGING_STORAGE_KEY, "enabled");
    } else {
      window.localStorage.removeItem(BOT_LOGGING_STORAGE_KEY);
    }
  } catch {
    // Best effort only
  }
};

export const botDebugLog = (...args: unknown[]): void => {
  if (!isPrototypeBotLoggingEnabled()) {
    return;
  }

  console.log(...args);
};
