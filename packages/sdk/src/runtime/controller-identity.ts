import { generateControllerId } from "../utils/ids";

const DEVICE_ID_STORAGE_KEY = "airjam_controller_device_id";
const ROOM_BINDINGS_STORAGE_KEY = "airjam_controller_room_bindings";

export interface ControllerRoomBinding {
  controllerId: string;
  resumeCapabilityToken: string;
}

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
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
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

  const created = generateControllerDeviceId();
  try {
    const existing = storage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.trim().length >= 8) {
      return existing;
    }
    storage.setItem(DEVICE_ID_STORAGE_KEY, created);
  } catch {
    // Device identity remains a usable in-memory hint when storage is denied.
  }
  return created;
};

const readRoomBindings = (
  storage: Storage | null,
): Record<string, ControllerRoomBinding> => {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(ROOM_BINDINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, ControllerRoomBinding> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key.trim().length > 0 &&
        typeof value === "object" &&
        value !== null
      ) {
        const binding = value as Partial<ControllerRoomBinding>;
        if (
          typeof binding.controllerId === "string" &&
          binding.controllerId.trim().length >= 3 &&
          typeof binding.resumeCapabilityToken === "string" &&
          binding.resumeCapabilityToken.length > 0
        ) {
          next[key] = {
            controllerId: binding.controllerId,
            resumeCapabilityToken: binding.resumeCapabilityToken,
          };
        }
      }
    }
    return next;
  } catch {
    return {};
  }
};

const writeRoomBindings = (
  storage: Storage | null,
  bindings: Record<string, ControllerRoomBinding>,
): void => {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(ROOM_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // The controller runtime retains its private binding in memory.
  }
};

export const readControllerRoomBinding = (
  roomId: string,
): ControllerRoomBinding | null => {
  return readControllerRoomBindingFromStorage(getLocalStorage(), roomId);
};

export const readControllerRoomBindingFromStorage = (
  storage: Storage | null,
  roomId: string,
): ControllerRoomBinding | null => {
  const bindings = readRoomBindings(storage);
  const binding = bindings[roomId.toUpperCase()];
  return binding ?? null;
};

export const writeControllerRoomBinding = (
  roomId: string,
  binding: ControllerRoomBinding,
): void => {
  writeControllerRoomBindingToStorage(getLocalStorage(), roomId, binding);
};

export const writeControllerRoomBindingToStorage = (
  storage: Storage | null,
  roomId: string,
  binding: ControllerRoomBinding,
): void => {
  if (!roomId || !binding.controllerId || !binding.resumeCapabilityToken) {
    return;
  }
  const bindings = readRoomBindings(storage);
  bindings[roomId.toUpperCase()] = binding;
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
