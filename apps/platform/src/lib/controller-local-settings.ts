import { useSyncExternalStore } from "react";

export interface ControllerLocalSettingsSnapshot {
  hapticsEnabled: boolean;
}

const STORAGE_KEY = "airjam.controller.local-settings";

const DEFAULT_CONTROLLER_LOCAL_SETTINGS: ControllerLocalSettingsSnapshot =
  Object.freeze({
    hapticsEnabled: true,
  });

const listeners = new Set<() => void>();
let clientSnapshotCache: ControllerLocalSettingsSnapshot | null = null;
let clientSnapshotKey = "";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeControllerLocalSettings = (
  value: unknown,
): ControllerLocalSettingsSnapshot => {
  if (!isRecord(value)) {
    return DEFAULT_CONTROLLER_LOCAL_SETTINGS;
  }

  return {
    hapticsEnabled:
      typeof value.hapticsEnabled === "boolean"
        ? value.hapticsEnabled
        : DEFAULT_CONTROLLER_LOCAL_SETTINGS.hapticsEnabled,
  };
};

const readRawControllerLocalSettings = (): ControllerLocalSettingsSnapshot => {
  if (typeof window === "undefined") {
    return DEFAULT_CONTROLLER_LOCAL_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CONTROLLER_LOCAL_SETTINGS;
    }

    return normalizeControllerLocalSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_CONTROLLER_LOCAL_SETTINGS;
  }
};

export const getControllerLocalSettingsServerSnapshot =
  (): ControllerLocalSettingsSnapshot => DEFAULT_CONTROLLER_LOCAL_SETTINGS;

export const getControllerLocalSettingsClientSnapshot =
  (): ControllerLocalSettingsSnapshot => {
    const nextSnapshot = readRawControllerLocalSettings();
    const nextKey = String(nextSnapshot.hapticsEnabled);

    if (clientSnapshotCache && nextKey === clientSnapshotKey) {
      return clientSnapshotCache;
    }

    clientSnapshotKey = nextKey;
    clientSnapshotCache = nextSnapshot.hapticsEnabled
      ? DEFAULT_CONTROLLER_LOCAL_SETTINGS
      : nextSnapshot;
    return clientSnapshotCache;
  };

export const subscribeControllerLocalSettings = (
  onStoreChange: () => void,
): (() => void) => {
  listeners.add(onStoreChange);

  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
};

const notifyControllerLocalSettingsChanged = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const writeControllerLocalSettings = (
  settings: ControllerLocalSettingsSnapshot,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  notifyControllerLocalSettingsChanged();
};

export const updateControllerLocalSettings = (
  patch: Partial<ControllerLocalSettingsSnapshot>,
): void => {
  writeControllerLocalSettings({
    ...readRawControllerLocalSettings(),
    ...patch,
  });
};

export const useControllerLocalSettings = (): {
  settings: ControllerLocalSettingsSnapshot;
  updateSettings: (patch: Partial<ControllerLocalSettingsSnapshot>) => void;
} => {
  const settings = useSyncExternalStore(
    subscribeControllerLocalSettings,
    getControllerLocalSettingsClientSnapshot,
    getControllerLocalSettingsServerSnapshot,
  );

  return {
    settings,
    updateSettings: updateControllerLocalSettings,
  };
};
