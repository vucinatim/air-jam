import { describe, expect, it } from "vitest";
import { useControllerLifecyclePermissions } from "../src/hooks/use-controller-lifecycle-permissions";

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
});
