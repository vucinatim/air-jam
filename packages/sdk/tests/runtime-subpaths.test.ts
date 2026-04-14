import { describe, expect, it, vi } from "vitest";
import { AIRJAM_DEV_LOG_EVENTS } from "../src/protocol";
import {
  createHostRuntimeControlContract,
  useControllerRuntimeControlContract,
} from "../src/runtime-control";
import {
  createControllerRuntimeInspectionContract,
  useHostRuntimeInspectionContract,
} from "../src/runtime-inspection";
import {
  createRuntimeObservabilityEvent,
  useRuntimeObservabilitySubscription,
} from "../src/runtime-observability";
import { createPrefabCatalog, definePrefab } from "../src/prefabs";
import { z } from "zod";

describe("runtime experimental subpaths", () => {
  it("re-export the control contract seam from the dedicated leaf", () => {
    const toggleRuntimeState = vi.fn();
    const contract = createHostRuntimeControlContract({
      runtimeState: "paused",
      toggleRuntimeState,
      reconnect: vi.fn(),
      sendState: vi.fn(() => true),
      sendSignal: vi.fn(),
    });

    contract.setRuntimeState("playing");

    expect(contract.role).toBe("host");
    expect(toggleRuntimeState).toHaveBeenCalledTimes(1);
    expect(typeof useControllerRuntimeControlContract).toBe("function");
  });

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
      stateMessage: "Ready",
    });

    expect(contract.role).toBe("controller");
    expect(contract.roomId).toBe("ROOM");
    expect(typeof useHostRuntimeInspectionContract).toBe("function");
  });

  it("re-export the observability seam from the dedicated leaf", () => {
    const event = createRuntimeObservabilityEvent({
      event: AIRJAM_DEV_LOG_EVENTS.runtime.socketConnected,
      message: "Connected",
      role: "host",
      roomId: "ROOM",
    });

    expect(event.source).toBe("runtime");
    expect(typeof useRuntimeObservabilitySubscription).toBe("function");
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
