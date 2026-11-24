import type { JSX, ReactNode } from "react";
import type { JoinUrlStatus } from "../core/connection-store";
import {
  PHONE_JOIN_UNAVAILABLE_MESSAGE,
  resolvePhoneJoinUrl,
} from "../core/phone-join-url";
import { readEmbeddedHostChildSession } from "../runtime/embedded-runtime-adapters";
import { cn } from "../utils/cn";
import { JoinUrlActionButtons } from "./join-url-action-buttons";
import { JoinUrlField } from "./join-url-field";

export interface JoinUrlControlsProps {
  value: string | null | undefined;
  status?: JoinUrlStatus;
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
  status = "ready",
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
  // An embedding parent such as the Arcade owns the room's join address and code.
  if (readEmbeddedHostChildSession()) return null;

  const joinUrl = status === "ready" ? resolvePhoneJoinUrl(value) : null;
  if (status !== "loading" && !joinUrl)
    return (
      <p className={cn("text-sm text-white/70", className)}>
        {PHONE_JOIN_UNAVAILABLE_MESSAGE}
      </p>
    );

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex flex-col gap-3">
        <JoinUrlField
          value={joinUrl}
          status={status}
          label={label}
          helperText={helperText}
          className="w-full min-w-0"
          inputClassName={inputClassName}
        />
        <JoinUrlActionButtons
          hasValue={Boolean(joinUrl)}
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
