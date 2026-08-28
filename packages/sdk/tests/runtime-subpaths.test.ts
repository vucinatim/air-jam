import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createPrefabCatalog, definePrefab } from "../src/prefabs";
import {
  createControllerRuntimeInspectionContract,
  useHostRuntimeInspectionContract,
} from "../src/runtime-inspection";
import { DEFAULT_ROOM_PLATFORM_SETTINGS } from "../src/settings/platform-settings";

describe("runtime experimental subpaths", () => {
  it("re-export the inspection contract seam from the dedicated leaf", () => {
    const contract = createControllerRuntimeInspectionContract({
      roomId: "ROOM",
      controllerId: "controller-1",
      connectionStatus: "connected",
      players: [],
      selfPlayer: null,
      lastError: undefined,
      runtimeState: "playing",
      controllerOrientation: "landscape",
      roomSettings: DEFAULT_ROOM_PLATFORM_SETTINGS,
      stateMessage: "Ready",
    });

    expect(contract.role).toBe("controller");
    expect(contract.roomId).toBe("ROOM");
    expect(typeof useHostRuntimeInspectionContract).toBe("function");
  });

  it("re-exports the prefab contract seam from the dedicated leaf", () => {
    const catalog = createPrefabCatalog([
      definePrefab({
        id: "test.prefab.default",
        label: "Test Prefab",
        category: "prop",
        description: "A prefab leaf contract.",
        tags: ["test"],
        defaultProps: { size: 1 },
        configSchema: z.object({ size: z.number().positive() }),
        render: ({ size }) => size,
      }),
    ] as const);

    expect(catalog[0]?.id).toBe("test.prefab.default");
  });
});
