import { describe, expect, it } from "vitest";
import {
  createControllerRuntimeInspectionContract,
  createHostRuntimeInspectionContract,
} from "../src/runtime/contracts/inspection";
import { DEFAULT_ROOM_PLATFORM_SETTINGS } from "../src/settings/platform-settings";

describe("runtime contracts", () => {
  it("creates host inspection snapshots from the mounted runtime API", () => {
    const inspection = createHostRuntimeInspectionContract({
      roomId: "ABCD",
      joinUrl: "https://example.com/controller?room=ABCD",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [{ id: "p1", label: "Player 1" }],
      controllers: [
        {
          controllerId: "p1",
          source: "phone",
          connected: true,
          resumeLeaseExpiresAt: null,
          player: { id: "p1", label: "Player 1" },
        },
      ],
      lastError: undefined,
      mode: "standalone",
      runtimeState: "playing",
    });

    expect(inspection).toEqual({
      role: "host",
      roomId: "ABCD",
      joinUrl: "https://example.com/controller?room=ABCD",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [{ id: "p1", label: "Player 1" }],
      controllers: [
        {
          controllerId: "p1",
          source: "phone",
          connected: true,
          resumeLeaseExpiresAt: null,
          player: { id: "p1", label: "Player 1" },
        },
      ],
      lastError: undefined,
      mode: "standalone",
      runtimeState: "playing",
    });
  });

  it("creates controller inspection snapshots from the mounted runtime API", () => {
    const player = { id: "p1", label: "Player 1" };
    const inspection = createControllerRuntimeInspectionContract({
      roomId: "ABCD",
      controllerId: "controller-1",
      connectionStatus: "connected",
      players: [player],
      selfPlayer: player,
      lastError: undefined,
      runtimeState: "playing",
      controllerOrientation: "landscape",
      roomSettings: DEFAULT_ROOM_PLATFORM_SETTINGS,
      stateMessage: "Go",
    });

    expect(inspection).toEqual({
      role: "controller",
      roomId: "ABCD",
      controllerId: "controller-1",
      connectionStatus: "connected",
      players: [player],
      selfPlayer: player,
      lastError: undefined,
      runtimeState: "playing",
      controllerOrientation: "landscape",
      roomSettings: DEFAULT_ROOM_PLATFORM_SETTINGS,
      stateMessage: "Go",
    });
  });
});
