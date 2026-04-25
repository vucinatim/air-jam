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
  qrVisible?: boolean;
  onToggleQr?: () => void;
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
  qrVisible = false,
  onToggleQr,
  className,
  inputClassName,
  buttonClassName,
}: JoinUrlControlsProps): JSX.Element => {
  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex flex-col gap-3">
        <JoinUrlField
          value={value}
          label={label}
          helperText={helperText}
          className="w-full min-w-0"
          inputClassName={inputClassName}
        />
        <JoinUrlActionButtons
          hasValue={hasValue}
          copied={copied}
          onCopy={onCopy}
          onOpen={onOpen}
          qrVisible={qrVisible}
          onToggleQr={onToggleQr}
          className="w-full"
          buttonClassName={buttonClassName}
        />
      </div>
    </div>
  );
};
