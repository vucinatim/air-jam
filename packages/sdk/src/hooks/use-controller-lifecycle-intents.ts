export interface UseControllerLifecycleIntentsOptions {
  onStart?: () => void;
  onTogglePause?: () => void;
  onBackToLobby?: () => void;
  onRestart?: () => void;
}

export interface ControllerLifecycleIntents {
  onStart?: () => void;
  onTogglePause?: () => void;
  onBackToLobby?: () => void;
  onRestart?: () => void;
}

export const useControllerLifecycleIntents = ({
  onStart,
  onTogglePause,
  onBackToLobby,
  onRestart,
}: UseControllerLifecycleIntentsOptions): ControllerLifecycleIntents => {
  return {
    onStart,
    onTogglePause,
    onBackToLobby,
    onRestart,
  };
};
