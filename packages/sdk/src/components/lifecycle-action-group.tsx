import { House, Pause, Play, RotateCcw } from "lucide-react";
import type { JSX } from "react";
import {
  type LifecycleActionKind,
  useLifecycleActionGroupModel,
} from "../hooks/use-lifecycle-action-group-model";
import type { ShellMatchPhase } from "../lifecycle";
import type { RuntimeState } from "../protocol";
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
  presentation?: "pill" | "icon";
  visibleKinds?: LifecycleActionKind[];
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
  presentation = "pill",
  visibleKinds,
  className,
  buttonClassName,
}: LifecycleActionGroupProps): JSX.Element | null => {
  const { actions: allActions } = useLifecycleActionGroupModel({
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

  const actions = visibleKinds
    ? allActions.filter((action) => visibleKinds.includes(action.kind))
    : allActions;

  if (actions.length === 0) {
    return null;
  }

  const renderIcon = (
    kind: LifecycleActionKind,
    label: string,
  ): JSX.Element => {
    switch (kind) {
      case "start":
        return <Play aria-hidden className="size-4.5" />;
      case "pause-toggle":
        return label.toLowerCase() === "resume" ? (
          <Play aria-hidden className="size-4.5" />
        ) : (
          <Pause aria-hidden className="size-4.5" />
        );
      case "restart":
        return <RotateCcw aria-hidden className="size-4.5" />;
      case "back-to-lobby":
        return <House aria-hidden className="size-4.5" />;
    }
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center justify-end gap-1.5 overflow-x-auto",
        className,
      )}
    >
      {actions.map((action) => (
        <Button
          key={action.kind}
          type="button"
          variant={
            presentation === "icon"
              ? action.tone === "primary"
                ? "secondary"
                : "ghost"
              : action.tone === "primary"
                ? "default"
                : "outline"
          }
          size={presentation === "icon" ? "icon-sm" : undefined}
          onClick={action.onPress}
          disabled={action.disabled}
          aria-label={action.label}
          title={action.label}
          className={cn(
            presentation === "icon"
              ? action.tone === "primary"
                ? "size-9 shrink-0 rounded-full border border-white/20 bg-white text-black hover:bg-white/90 sm:size-10"
                : "size-9 shrink-0 rounded-full border border-white/12 bg-white/6 text-white hover:bg-white/12 sm:size-10"
              : action.tone === "primary"
                ? "h-8 shrink-0 rounded-full border border-white/15 bg-white px-3 py-0 text-[9px] font-semibold tracking-[0.12em] whitespace-nowrap text-black uppercase hover:bg-white/90 sm:h-9 sm:px-4 sm:text-[10px] sm:tracking-[0.16em]"
                : "h-8 shrink-0 rounded-full border-white/15 bg-white/5 px-3 py-0 text-[9px] font-semibold tracking-[0.12em] whitespace-nowrap text-white uppercase hover:bg-white/10 sm:h-9 sm:px-4 sm:text-[10px] sm:tracking-[0.16em]",
            buttonClassName,
          )}
        >
          {presentation === "icon"
            ? renderIcon(action.kind, action.label)
            : action.label}
        </Button>
      ))}
    </div>
  );
};
