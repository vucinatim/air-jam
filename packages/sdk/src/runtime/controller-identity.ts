import { z } from "zod";
import type { ControllerRoomBinding } from "../core/environment";

const ROOM_BINDINGS_STORAGE_KEY = "airjam_controller_room_bindings";

export type { ControllerRoomBinding };

const bindingsSchema = z.record(
  z.string(),
  z.object({
    key: z.string().min(16),
    instance: z.string().min(1).optional(),
  }),
);

const localStorageOrNull = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const readBindings = (storage: Storage) => {
  try {
    const parsed = bindingsSchema.safeParse(
      JSON.parse(storage.getItem(ROOM_BINDINGS_STORAGE_KEY) ?? "{}"),
    );
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

/**
 * Where a phone page keeps the key and instance of each seat it holds, so a
 * reload resumes the seat. Several controllers on one page, such as preview
 * controllers sharing a screen, each keep theirs under their own `scope`.
 * A page whose storage is denied joins afresh after a reload.
 */
export const createControllerRoomBindings = (
  scope: string,
  storage: Storage | null = localStorageOrNull(),
) => {
  const entry = (roomId: string) => `${scope}:${roomId.toUpperCase()}`;
  const write = (
    update: (bindings: Record<string, ControllerRoomBinding>) => void,
  ) => {
    if (!storage) return;
    const bindings = readBindings(storage);
    update(bindings);
    try {
      storage.setItem(ROOM_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
    } catch {
      // A seat simply is not resumed after a reload when storage is full or denied.
    }
  };
  return {
    readBinding: (roomId: string): ControllerRoomBinding | null =>
      storage ? (readBindings(storage)[entry(roomId)] ?? null) : null,
    writeBinding: (roomId: string, binding: ControllerRoomBinding) =>
      write((bindings) => {
        bindings[entry(roomId)] = binding;
      }),
    clearBinding: (roomId: string) =>
      write((bindings) => {
        delete bindings[entry(roomId)];
      }),
  };
};
