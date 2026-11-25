import { useId, type JSX, type ReactNode } from "react";
import type { JoinUrlStatus } from "../core/connection-store";
import {
  PHONE_JOIN_UNAVAILABLE_MESSAGE,
  resolvePhoneJoinUrl,
} from "../core/phone-join-url";
import { cn } from "../utils/cn";
import {
  shellFieldClassName,
  shellHelperTextClassName,
  shellLabelClassName,
} from "./shell-classes";

export interface JoinUrlFieldProps {
  value: string | null | undefined;
  status?: JoinUrlStatus;
  label?: ReactNode;
  helperText?: ReactNode;
  className?: string;
  inputClassName?: string;
  inputId?: string;
  inputName?: string;
}

export const JoinUrlField = ({
  value,
  status = "ready",
  label = "Controller link",
  helperText,
  className,
  inputClassName,
  inputId,
  inputName = "airjam-controller-link",
}: JoinUrlFieldProps): JSX.Element => {
  const joinUrl = status === "ready" ? resolvePhoneJoinUrl(value) : null;
  const generatedInputId = useId();
  const resolvedInputId = inputId ?? generatedInputId;

  if (status !== "loading" && !joinUrl)
    return (
      <p className={cn(shellHelperTextClassName, className)}>
        {PHONE_JOIN_UNAVAILABLE_MESSAGE}
      </p>
    );

  return (
    <div className={cn("space-y-2.5", className)}>
      <label className={shellLabelClassName} htmlFor={resolvedInputId}>
        {label}
      </label>
      <input
        id={resolvedInputId}
        name={inputName}
        type="text"
        readOnly
        value={joinUrl ?? ""}
        placeholder={
          status === "loading" ? "Generating join link..." : undefined
        }
        aria-label={typeof label === "string" ? label : "Controller join link"}
        className={cn(shellFieldClassName, inputClassName)}
      />
      {helperText ? (
        <div className={shellHelperTextClassName}>{helperText}</div>
      ) : null}
    </div>
  );
};
