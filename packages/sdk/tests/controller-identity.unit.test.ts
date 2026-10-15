import { beforeEach, describe, expect, it, vi } from "vitest";
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

    const binding = {
      controllerId: "ctrl_1",
      resumeCapabilityToken: "private-proof",
    };
    writeControllerRoomBindingToStorage(storage, "room", binding);
    expect(readControllerRoomBindingFromStorage(storage, "ROOM")).toEqual(
      binding,
    );

    clearControllerRoomBindingFromStorage(storage, "room");
    expect(readControllerRoomBindingFromStorage(storage, "ROOM")).toBeNull();
  });

  it("discards ID-only and malformed stored bindings rather than treating them as authority", () => {
    storage.setItem(
      "airjam_controller_room_bindings",
      JSON.stringify({
        OLD: "ctrl_1",
        MISSING: { controllerId: "ctrl_2" },
        EMPTY: { controllerId: "ctrl_3", resumeCapabilityToken: "" },
        NULL: null,
      }),
    );
    for (const roomId of ["OLD", "MISSING", "EMPTY", "NULL"]) {
      expect(readControllerRoomBindingFromStorage(storage, roomId)).toBeNull();
    }
    writeControllerRoomBindingToStorage(storage, "NEW", {
      controllerId: "ctrl_new",
      resumeCapabilityToken: "new-proof",
    });
    expect(
      JSON.parse(storage.getItem("airjam_controller_room_bindings")!),
    ).toEqual({
      NEW: { controllerId: "ctrl_new", resumeCapabilityToken: "new-proof" },
      "NEW/ctrl_new": {
        controllerId: "ctrl_new",
        resumeCapabilityToken: "new-proof",
      },
    });
  });

  it("retains each phone's authority when multiple controllers share a room", () => {
    const first = {
      controllerId: "ctrl_first",
      resumeCapabilityToken: "first-proof",
    };
    const second = {
      controllerId: "ctrl_second",
      resumeCapabilityToken: "second-proof",
    };
    writeControllerRoomBindingToStorage(storage, "ROOM", first);
    writeControllerRoomBindingToStorage(storage, "ROOM", second);
    expect(
      readControllerRoomBindingFromStorage(storage, "room", first.controllerId),
    ).toEqual(first);
    expect(
      readControllerRoomBindingFromStorage(
        storage,
        "ROOM",
        second.controllerId,
      ),
    ).toEqual(second);
    expect(readControllerRoomBindingFromStorage(storage, "ROOM")).toEqual(
      second,
    );
    expect(
      readControllerRoomBindingFromStorage(storage, "ROOM", "ctrl_unknown"),
    ).toBeNull();
    clearControllerRoomBindingFromStorage(storage, "room", first.controllerId);
    expect(
      readControllerRoomBindingFromStorage(storage, "ROOM", first.controllerId),
    ).toBeNull();
    expect(
      readControllerRoomBindingFromStorage(
        storage,
        "ROOM",
        second.controllerId,
      ),
    ).toEqual(second);
    clearControllerRoomBindingFromStorage(storage, "room");
    expect(
      readControllerRoomBindingFromStorage(
        storage,
        "ROOM",
        second.controllerId,
      ),
    ).toBeNull();
  });

  it("can resume an existing room binding only for its matching controller", () => {
    const binding = {
      controllerId: "ctrl_existing",
      resumeCapabilityToken: "existing-proof",
    };
    storage.setItem(
      "airjam_controller_room_bindings",
      JSON.stringify({ ROOM: binding }),
    );
    expect(
      readControllerRoomBindingFromStorage(
        storage,
        "room",
        binding.controllerId,
      ),
    ).toEqual(binding);
    expect(
      readControllerRoomBindingFromStorage(storage, "room", "ctrl_other"),
    ).toBeNull();
  });

  it("does not fail joining when storage reads or writes are denied", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("Read denied");
    });
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("Write denied");
    });
    expect(getOrCreateControllerDeviceIdFromStorage(storage)).toBeTruthy();
    expect(readControllerRoomBindingFromStorage(storage, "ROOM")).toBeNull();
    expect(() =>
      writeControllerRoomBindingToStorage(storage, "ROOM", {
        controllerId: "ctrl_memory",
        resumeCapabilityToken: "private-proof",
      }),
    ).not.toThrow();
  });
});
