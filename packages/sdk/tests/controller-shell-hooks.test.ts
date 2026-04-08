import { describe, expect, it } from "vitest";
import {
  useControllerLifecycleIntents,
  useControllerLifecyclePermissions,
  useControllerShellStatus,
} from "../src/ui";

describe("controller shell hooks", () => {
  it("derives phase-aware lifecycle permissions", () => {
    expect(
      useControllerLifecyclePermissions({
        phase: "lobby",
        canStartMatch: true,
        canSendSystemCommand: false,
      }),
    ).toEqual({
      canStart: true,
      canPauseToggle: false,
      canRestart: false,
      canBackToLobby: false,
      canInteractForPhase: true,
    });

    expect(
      useControllerLifecyclePermissions({
        phase: "ended",
        canStartMatch: false,
        canSendSystemCommand: true,
      }),
    ).toEqual({
      canStart: false,
      canPauseToggle: false,
      canRestart: true,
      canBackToLobby: true,
      canInteractForPhase: true,
    });
  });

  it("derives display metadata for controller headers", () => {
    expect(
      useControllerShellStatus({
        roomId: null,
        connectionStatus: "connected",
        playerLabel: "Tim",
      }),
    ).toEqual({
      connectionStatus: "connected",
      displayName: "Tim",
      roomDisplay: "----",
      roomLine: "Room ----",
      hasIdentity: true,
      identityInitial: "T",
    });
  });

  it("returns normalized lifecycle intent handlers", () => {
    const onStart = () => undefined;
    const onBackToLobby = () => undefined;

    expect(
      useControllerLifecycleIntents({
        onStart,
        onBackToLobby,
      }),
    ).toEqual({
      onStart,
      onTogglePause: undefined,
      onBackToLobby,
      onRestart: undefined,
    });
  });
});
