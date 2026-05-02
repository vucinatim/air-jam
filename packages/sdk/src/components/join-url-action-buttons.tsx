import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import type { JSX } from "react";
import { cn } from "../utils/cn";
import { shellUtilityButtonClassName } from "./shell-classes";
import { Button } from "./ui/button";

export interface JoinUrlActionButtonsProps {
  hasValue: boolean;
  copied?: boolean;
  onCopy?: () => void;
  onOpen?: () => void;
  qrVisible?: boolean;
  onToggleQr?: () => void;
  className?: string;
  buttonClassName?: string;
}

export const JoinUrlActionButtons = ({
  hasValue,
  copied = false,
  onCopy,
  onOpen,
  qrVisible = false,
  onToggleQr,
  className,
  buttonClassName,
}: JoinUrlActionButtonsProps): JSX.Element => {
  const showsQrButton = typeof onToggleQr === "function";

  return (
    <div
      className={cn(
        "grid w-full gap-2",
        showsQrButton ? "grid-cols-3" : "grid-cols-2",
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        disabled={!hasValue || !onCopy}
        onClick={onCopy}
        aria-label={copied ? "Copied join link" : "Copy join link"}
        title={copied ? "Copied" : "Copy join link"}
        className={cn(
          "h-11 min-w-0 justify-center rounded-2xl px-3 text-sm",
          shellUtilityButtonClassName,
          buttonClassName,
        )}
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        <span className="truncate">{copied ? "Copied" : "Copy"}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={!hasValue || !onOpen}
        onClick={onOpen}
        aria-label="Open join link"
        title="Open join link"
        className={cn(
          "h-11 min-w-0 justify-center rounded-2xl px-3 text-sm",
          shellUtilityButtonClassName,
          buttonClassName,
        )}
      >
        <ExternalLink className="h-4 w-4" aria-hidden />
        <span className="truncate">New tab</span>
      </Button>
      {showsQrButton ? (
        <Button
          type="button"
          variant="outline"
          disabled={!hasValue}
          aria-pressed={qrVisible}
          onClick={onToggleQr}
          aria-label={qrVisible ? "Hide join QR" : "Show join QR"}
          title={qrVisible ? "Hide join QR" : "Show join QR"}
          className={cn(
            "h-11 min-w-0 justify-center rounded-2xl px-3 text-sm",
            shellUtilityButtonClassName,
            buttonClassName,
          )}
        >
          <QrCode className="h-4 w-4" aria-hidden />
          <span className="truncate">{qrVisible ? "Hide QR" : "QR code"}</span>
        </Button>
      ) : null}
    </div>
  );
};
