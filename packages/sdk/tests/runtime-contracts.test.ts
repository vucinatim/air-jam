import { describe, expect, it, vi } from "vitest";
import {
  createControllerRuntimeControlContract,
  createHostRuntimeControlContract,
} from "../src/runtime/contracts/control";
import {
  createControllerRuntimeInspectionContract,
  createHostRuntimeInspectionContract,
} from "../src/runtime/contracts/inspection";

describe("runtime contracts", () => {
  it("normalizes host runtime control without inventing a second path", () => {
    const toggleRuntimeState = vi.fn();
    const reconnect = vi.fn();
    const sendState = vi.fn(() => true);
    const sendSignal = vi.fn();

    const control = createHostRuntimeControlContract({
      runtimeState: "paused",
      toggleRuntimeState,
      reconnect,
      sendState,
      sendSignal,
    });

    control.setRuntimeState("paused");
    control.setRuntimeState("playing");
    control.toggleRuntimeState();
    control.reconnect();
    control.sendState({ runtimeState: "playing" });
    control.sendSignal("TOAST", { message: "Ready" });

    expect(toggleRuntimeState).toHaveBeenCalledTimes(2);
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(sendState).toHaveBeenCalledWith({ runtimeState: "playing" });
    expect(sendSignal).toHaveBeenCalledWith("TOAST", { message: "Ready" });
  });

  it("normalizes controller runtime control as session-driving commands", async () => {
    const sendSystemCommand = vi.fn();
    const setNickname = vi.fn();
    const setAvatarId = vi.fn();
    const updatePlayerProfile = vi.fn(async () => ({
      ok: true as const,
      player: {
        id: "p1",
        label: "New",
        connected: true,
      },
    }));

    const control = createControllerRuntimeControlContract({
      runtimeState: "paused",
      sendSystemCommand,
      setNickname,
      setAvatarId,
      updatePlayerProfile,
      reconnect: vi.fn(),
    });

    control.sendSystemCommand("toggle_pause");
    control.setNicknameDraft("Riley");
    control.setAvatarIdDraft("pilot");
    await control.updatePlayerProfile({ label: "Riley" });

    expect(sendSystemCommand).toHaveBeenCalledWith("toggle_pause");
    expect(setNickname).toHaveBeenCalledWith("Riley");
    expect(setAvatarId).toHaveBeenCalledWith("pilot");
    expect(updatePlayerProfile).toHaveBeenCalledWith({ label: "Riley" });
  });

  it("creates host inspection snapshots from the mounted runtime API", () => {
    const inspection = createHostRuntimeInspectionContract({
      roomId: "ABCD",
      joinUrl: "https://example.com/controller?room=ABCD",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [{ id: "p1", label: "Player 1" }],
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
      stateMessage: "Go",
    });
  });
});
