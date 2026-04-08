import type { JSX } from "react";
import type { ShellMatchPhase } from "../lifecycle";
import type { RuntimeState } from "../protocol";
import { useLifecycleActionGroupModel } from "../hooks/use-lifecycle-action-group-model";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";

export interface LifecycleActionGroupProps {
  phase: ShellMatchPhase;
  runtimeState?: RuntimeState;
  canInteract?: boolean;
  onStart?: () => void;
  onTogglePause?: () => void;
  onBackToLobby?: () => void;
  onRestart?: () => void;
  startLabel?: string;
  restartLabel?: string;
  backLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export const LifecycleActionGroup = ({
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
  className,
  buttonClassName,
}: LifecycleActionGroupProps): JSX.Element | null => {
  const { actions } = useLifecycleActionGroupModel({
    phase,
    runtimeState,
    canInteract,
    onStart,
    onTogglePause,
    onBackToLobby,
    onRestart,
    startLabel,
    restartLabel,
    backLabel,
  });

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {actions.map((action) => (
        <Button
          key={action.kind}
          type="button"
          variant={action.tone === "primary" ? "default" : "outline"}
          onClick={action.onPress}
          disabled={action.disabled}
          className={cn(
            action.tone === "primary"
              ? "rounded-full border border-white/15 bg-white px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-black uppercase hover:bg-white/90 sm:px-4 sm:text-xs sm:tracking-[0.18em]"
              : "rounded-full border-white/15 bg-white/5 px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-white uppercase hover:bg-white/10 sm:px-4 sm:text-xs sm:tracking-[0.18em]",
            buttonClassName,
          )}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};
