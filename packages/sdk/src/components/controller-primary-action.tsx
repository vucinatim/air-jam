import type { JSX, ReactNode } from "react";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";

export interface ControllerPrimaryActionProps {
  label: string;
  helper?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  className?: string;
  buttonClassName?: string;
}

export const ControllerPrimaryAction = ({
  label,
  helper,
  icon,
  disabled,
  onPress,
  className,
  buttonClassName,
}: ControllerPrimaryActionProps): JSX.Element => {
  return (
    <div className={cn("mt-auto pt-3", className)}>
      <Button
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-auto min-h-18 w-full items-center justify-between rounded-3xl border border-white/15 px-5 py-4 text-left shadow-lg",
          buttonClassName,
        )}
      >
        <div className="min-w-0">
          <div className="truncate text-lg font-black uppercase tracking-[0.12em]">
            {label}
          </div>
          {helper ? (
            <div className="mt-1 text-xs font-medium normal-case tracking-normal opacity-80">
              {helper}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="ml-4 flex shrink-0 items-center justify-center">{icon}</div>
        ) : null}
      </Button>
    </div>
  );
};
