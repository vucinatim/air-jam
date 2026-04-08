import type { LifecycleVisualPhase } from "./use-lifecycle-action-group-model";

export interface UseControllerLifecyclePermissionsOptions {
  phase: LifecycleVisualPhase;
  canStartMatch?: boolean;
  canSendSystemCommand?: boolean;
}

export interface ControllerLifecyclePermissions {
  canStart: boolean;
  canPauseToggle: boolean;
  canRestart: boolean;
  canBackToLobby: boolean;
  canInteractForPhase: boolean;
}

export const useControllerLifecyclePermissions = ({
  phase,
  canStartMatch = false,
  canSendSystemCommand = false,
}: UseControllerLifecyclePermissionsOptions): ControllerLifecyclePermissions => {
  const canStart = phase === "lobby" && canStartMatch;
  const canPauseToggle = phase === "playing" && canSendSystemCommand;
  const canRestart = phase === "ended" && canSendSystemCommand;
  const canBackToLobby = phase !== "lobby" && canSendSystemCommand;
  const canInteractForPhase = phase === "lobby" ? canStart : canSendSystemCommand;

  return {
    canStart,
    canPauseToggle,
    canRestart,
    canBackToLobby,
    canInteractForPhase,
  };
};
