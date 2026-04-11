import type { JSX, ReactNode } from "react";
import { cn } from "../utils/cn";
import { JoinUrlActionButtons } from "./join-url-action-buttons";
import { JoinUrlField } from "./join-url-field";

export interface JoinUrlControlsProps {
  value: string | null | undefined;
  label?: ReactNode;
  helperText?: ReactNode;
  copied?: boolean;
  onCopy?: () => void;
  onOpen?: () => void;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export const JoinUrlControls = ({
  value,
  label = "Controller link",
  helperText,
  copied = false,
  onCopy,
  onOpen,
  className,
  inputClassName,
  buttonClassName,
}: JoinUrlControlsProps): JSX.Element => {
  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <JoinUrlField
          value={value}
          label={label}
          helperText={helperText}
          className="min-w-0 flex-1"
          inputClassName={inputClassName}
        />
        <JoinUrlActionButtons
          hasValue={hasValue}
          copied={copied}
          onCopy={onCopy}
          onOpen={onOpen}
          className="shrink-0 sm:self-end"
          buttonClassName={buttonClassName}
        />
      </div>
    </div>
  );
};
