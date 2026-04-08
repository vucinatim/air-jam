import type { JSX, ReactNode } from "react";
import { cn } from "../utils/cn";

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
    <div className={cn("space-y-2", className)}>
      <div className="text-[10px] font-semibold tracking-[0.22em] text-white/60 uppercase">
        {label}
      </div>
      <input
        type="text"
        readOnly
        value={value ?? ""}
        placeholder={hasValue ? undefined : "Generating join link..."}
        aria-label={typeof label === "string" ? label : "Controller join link"}
        className={cn(
          "h-10 min-w-0 w-full rounded-none border border-white/15 bg-black/50 px-3 text-sm text-white outline-none placeholder:text-white/35",
          inputClassName,
        )}
      />
      {helperText ? (
        <div className="text-[11px] leading-5 text-white/55">{helperText}</div>
      ) : null}
    </div>
  );
};
