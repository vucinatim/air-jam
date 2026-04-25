import type { ShellMatchPhase } from "../lifecycle";
import type { RuntimeState } from "../protocol";

export type LifecycleVisualPhase = ShellMatchPhase;

export type LifecycleActionKind =
  | "start"
  | "pause-toggle"
  | "restart"
  | "back-to-lobby";

export interface LifecycleActionDescriptor {
  kind: LifecycleActionKind;
  label: string;
  disabled: boolean;
  tone: "primary" | "secondary";
  onPress?: () => void;
}

export interface UseLifecycleActionGroupModelProps {
  phase: LifecycleVisualPhase;
  runtimeState?: RuntimeState;
  canInteract?: boolean;
  onStart?: () => void;
  onTogglePause?: () => void;
  onBackToLobby?: () => void;
  onRestart?: () => void;
  startLabel?: string;
  restartLabel?: string;
  backLabel?: string;
  pauseLabel?: string;
  resumeLabel?: string;
}

export interface LifecycleActionGroupModel {
  isPaused: boolean;
  actions: LifecycleActionDescriptor[];
}

export const useLifecycleActionGroupModel = ({
  phase,
  runtimeState,
  canInteract = true,
  onStart,
  onTogglePause,
  onBackToLobby,
  onRestart,
  startLabel = "Start",
  restartLabel = "Restart",
  backLabel = "Back to Lobby",
  pauseLabel = "Pause",
  resumeLabel = "Resume",
}: UseLifecycleActionGroupModelProps): LifecycleActionGroupModel => {
  const isPaused = runtimeState === "paused";
  const actions: LifecycleActionDescriptor[] = [];

  if (phase === "lobby" && onStart) {
    actions.push({
      kind: "start",
      label: startLabel,
      disabled: !canInteract,
      tone: "primary",
      onPress: onStart,
    });
  }

  if (phase === "playing" && onTogglePause) {
    actions.push({
      kind: "pause-toggle",
      label: isPaused ? resumeLabel : pauseLabel,
      disabled: !canInteract,
      tone: "secondary",
      onPress: onTogglePause,
    });
  }

  if (phase === "ended" && (onRestart || onStart)) {
    actions.push({
      kind: "restart",
      label: restartLabel,
      disabled: !canInteract,
      tone: "primary",
      onPress: onRestart ?? onStart,
    });
  }

  if (phase !== "lobby" && onBackToLobby) {
    actions.push({
      kind: "back-to-lobby",
      label: backLabel,
      disabled: !canInteract,
      tone: "secondary",
      onPress: onBackToLobby,
    });
  }

  return { isPaused, actions };
};
