import type { JSX, ReactNode } from "react";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";

export interface ControllerPrimaryActionProps {
  label: string;
  helper?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  testId?: string;
  className?: string;
  buttonClassName?: string;
}

export const ControllerPrimaryAction = ({
  label,
  helper,
  icon,
  disabled,
  onPress,
  testId,
  className,
  buttonClassName,
}: ControllerPrimaryActionProps): JSX.Element => {
  return (
    <div className={cn("mt-auto pt-3", className)}>
      <Button
        type="button"
        onClick={onPress}
        disabled={disabled}
        data-testid={testId}
        aria-label={label}
        title={label}
        className={cn(
          "flex h-auto min-h-18 w-full items-center justify-between rounded-[1.5rem] border border-white/15 px-5 py-4 text-left shadow-lg",
          buttonClassName,
        )}
      >
        <div className="min-w-0">
          <div className="truncate text-base font-black tracking-[0.12em] uppercase sm:text-lg">
            {label}
          </div>
          {helper ? (
            <div className="mt-1 text-sm/5 font-medium tracking-normal normal-case opacity-80">
              {helper}
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="ml-4 flex shrink-0 items-center justify-center">
            {icon}
          </div>
        ) : null}
      </Button>
    </div>
  );
};
