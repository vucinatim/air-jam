import { generateControllerId } from "../utils/ids";

const DEVICE_ID_STORAGE_KEY = "airjam_controller_device_id";
const ROOM_BINDINGS_STORAGE_KEY = "airjam_controller_room_bindings";

const getLocalStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const generateControllerDeviceId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `d_${crypto.randomUUID()}`;
  }
  return `d_${generateControllerId()}_${Date.now().toString(36)}`;
};

export const getOrCreateControllerDeviceId = (): string => {
  return getOrCreateControllerDeviceIdFromStorage(getLocalStorage());
};

export const getOrCreateControllerDeviceIdFromStorage = (
  storage: Storage | null,
): string => {
  if (!storage) {
    return generateControllerDeviceId();
  }

  const existing = storage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing && existing.trim().length >= 8) {
    return existing;
  }

  const created = generateControllerDeviceId();
  storage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
};

const readRoomBindings = (storage: Storage | null): Record<string, string> => {
  if (!storage) {
    return {};
  }

  const raw = storage.getItem(ROOM_BINDINGS_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.trim().length > 0 && typeof value === "string") {
        next[key] = value;
      }
    }
    return next;
  } catch {
    return {};
  }
};

const writeRoomBindings = (
  storage: Storage | null,
  bindings: Record<string, string>,
): void => {
  if (!storage) {
    return;
  }
  storage.setItem(ROOM_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
};

export const readControllerRoomBinding = (roomId: string): string | null => {
  return readControllerRoomBindingFromStorage(getLocalStorage(), roomId);
};

export const readControllerRoomBindingFromStorage = (
  storage: Storage | null,
  roomId: string,
): string | null => {
  const bindings = readRoomBindings(storage);
  const binding = bindings[roomId.toUpperCase()];
  return typeof binding === "string" && binding.trim().length >= 3
    ? binding
    : null;
};

export const writeControllerRoomBinding = (
  roomId: string,
  controllerId: string,
): void => {
  writeControllerRoomBindingToStorage(getLocalStorage(), roomId, controllerId);
};

export const writeControllerRoomBindingToStorage = (
  storage: Storage | null,
  roomId: string,
  controllerId: string,
): void => {
  if (!roomId || !controllerId) {
    return;
  }
  const bindings = readRoomBindings(storage);
  bindings[roomId.toUpperCase()] = controllerId;
  writeRoomBindings(storage, bindings);
};

export const clearControllerRoomBinding = (roomId: string): void => {
  clearControllerRoomBindingFromStorage(getLocalStorage(), roomId);
};

export const clearControllerRoomBindingFromStorage = (
  storage: Storage | null,
  roomId: string,
): void => {
  const normalized = roomId.toUpperCase();
  const bindings = readRoomBindings(storage);
  if (!(normalized in bindings)) {
    return;
  }
  delete bindings[normalized];
  writeRoomBindings(storage, bindings);
};
