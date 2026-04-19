import type { JSX, ReactNode } from "react";
import { cn } from "../utils/cn";
import {
  shellFieldClassName,
  shellHelperTextClassName,
  shellLabelClassName,
} from "./shell-classes";

export interface JoinUrlFieldProps {
  value: string | null | undefined;
  label?: ReactNode;
  helperText?: ReactNode;
  className?: string;
  inputClassName?: string;
}

export const JoinUrlField = ({
  value,
  label = "Controller link",
  helperText,
  className,
  inputClassName,
}: JoinUrlFieldProps): JSX.Element => {
  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className={shellLabelClassName}>{label}</div>
      <input
        type="text"
        readOnly
        value={value ?? ""}
        placeholder={hasValue ? undefined : "Generating join link..."}
        aria-label={typeof label === "string" ? label : "Controller join link"}
        className={cn(shellFieldClassName, inputClassName)}
      />
      {helperText ? (
        <div className={shellHelperTextClassName}>{helperText}</div>
      ) : null}
    </div>
  );
};
