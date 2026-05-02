import { beforeEach, describe, expect, it } from "vitest";
import {
  clearControllerRoomBindingFromStorage,
  getOrCreateControllerDeviceIdFromStorage,
  readControllerRoomBindingFromStorage,
  writeControllerRoomBindingToStorage,
} from "../src/runtime/controller-identity";

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
};

describe("controller identity helpers", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("creates one stable controller device id and reuses it", () => {
    const first = getOrCreateControllerDeviceIdFromStorage(storage);
    const second = getOrCreateControllerDeviceIdFromStorage(storage);

    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("stores and clears room-scoped controller bindings", () => {
    expect(readControllerRoomBindingFromStorage(storage, "room")).toBeNull();

    writeControllerRoomBindingToStorage(storage, "room", "ctrl_1");
    expect(readControllerRoomBindingFromStorage(storage, "ROOM")).toBe(
      "ctrl_1",
    );

    clearControllerRoomBindingFromStorage(storage, "room");
    expect(readControllerRoomBindingFromStorage(storage, "ROOM")).toBeNull();
  });
});
