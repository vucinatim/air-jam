import type { JSX, ReactNode } from "react";
import { isEmbeddedHostRuntime } from "../runtime/host-realtime-client";
import { cn } from "../utils/cn";
import { JoinUrlActionButtons } from "./join-url-action-buttons";
import { JoinUrlField } from "./join-url-field";

/** The short address a person types instead of scanning: host plus `/join`. */
export const toJoinAddress = (joinUrl: string): string =>
  `${new URL(joinUrl).host.replace(/^www\./, "")}/join`;

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
}: JoinUrlControlsProps): JSX.Element | null => {
  const hasValue = Boolean(value && value.trim().length > 0);

  // Inside an embedding parent such as the Arcade, the child host's link
  // carries a private token that never belongs on screen; only the address a
  // player types, beside the room code, does.
  if (isEmbeddedHostRuntime())
    return value && hasValue ? (
      <p className={cn("text-sm", className)} data-testid="airjam-join-address">
        <span className="opacity-70">Join at </span>
        <span className="font-semibold">{toJoinAddress(value)}</span>
      </p>
    ) : null;

  return (
    <div className={cn("w-full space-y-3 text-left", className)}>
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
