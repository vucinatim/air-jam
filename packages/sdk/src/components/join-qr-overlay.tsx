import { useEffect, useState, type JSX, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils/cn";
import { RoomQrCode } from "./room-qr-code";
import { shellUtilityButtonClassName } from "./shell-classes";
import { Button } from "./ui/button";

export interface JoinQrOverlayProps {
  open: boolean;
  value: string | null | undefined;
  status?: "ready" | "loading" | "unavailable";
  roomId?: string | null;
  onClose?: () => void;
  title?: string;
  roomLabel?: string;
  description?: string;
  unavailableLabel?: string;
  loadingLabel?: string;
  qrAlt?: string;
  showCloseButton?: boolean;
  className?: string;
  panelClassName?: string;
  qrClassName?: string;
  bodyClassName?: string;
  messageClassName?: string;
  descriptionClassName?: string;
  closeButtonClassName?: string;
  size?: number;
}

export const JoinQrOverlay = ({
  open,
  value,
  status = "ready",
  roomId,
  onClose,
  title = "Scan QR code to join as a controller",
  roomLabel = "Join room",
  description = "Scan with your phone to connect as a controller.",
  unavailableLabel = "Join URL unavailable right now.",
  loadingLabel = "Preparing join QR…",
  qrAlt,
  showCloseButton = false,
  className,
  panelClassName,
  qrClassName,
  bodyClassName,
  messageClassName,
  descriptionClassName,
  closeButtonClassName,
  size = 260,
}: JoinQrOverlayProps): JSX.Element | null => {
  const joinUrlValue = value?.trim() ?? "";
  const effectiveStatus =
    status === "ready" && joinUrlValue.length === 0 ? "unavailable" : status;
  const overlaySize = `min(72vw, ${size}px)`;
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      setEntered(false);
      return;
    }

    setEntered(false);
    const frame = window.requestAnimationFrame(() => {
      setEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={roomId ? `Join room ${roomId}` : title}
      className={cn(
        "pointer-events-auto fixed inset-0 z-[120] flex cursor-pointer flex-col items-center justify-center bg-black/85 px-6 backdrop-blur-md transition-opacity duration-200 ease-out",
        entered ? "opacity-100" : "opacity-0",
        className,
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "flex cursor-default flex-col items-center gap-6 text-center transition-transform duration-200 ease-out",
          entered ? "translate-y-0" : "-translate-y-4",
          panelClassName,
        )}
        onClick={handlePanelClick}
      >
        <div className="space-y-1">
          <p className="text-[11px] tracking-[0.18em] text-slate-400 uppercase">
            {roomLabel}
          </p>
          {roomId ? (
            <p className="text-2xl font-semibold tracking-tight text-white tabular-nums">
              {roomId}
            </p>
          ) : null}
        </div>

        {effectiveStatus === "loading" ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border border-white/25 bg-white/6 px-5 py-10 text-sm text-white/70 shadow-sm",
              bodyClassName,
            )}
            style={{
              width: overlaySize,
              height: "auto",
              aspectRatio: "1 / 1",
            }}
          >
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white/85" />
            <span>{loadingLabel}</span>
          </div>
        ) : effectiveStatus === "ready" ? (
          <RoomQrCode
            value={joinUrlValue}
            size={size}
            padding={2}
            foregroundColor="#111827"
            backgroundColor="#ffffff"
            className={cn(
              "rounded-lg border border-white/25 bg-white/6 shadow-sm",
              qrClassName,
            )}
            style={{
              width: overlaySize,
              height: "auto",
              aspectRatio: "1 / 1",
            }}
            alt={
              qrAlt ??
              (roomId
                ? `QR code to join room ${roomId}`
                : "QR code to join as a controller")
            }
          />
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-lg border border-white/25 bg-white/6 px-5 py-10 text-sm text-white/70 shadow-sm",
              messageClassName,
            )}
            style={{
              width: overlaySize,
              height: "auto",
              aspectRatio: "1 / 1",
            }}
          >
            {unavailableLabel}
          </div>
        )}

        <p
          className={cn(
            "max-w-xs text-center text-sm text-slate-400",
            descriptionClassName,
          )}
        >
          {description}
        </p>

        {showCloseButton ? (
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className={cn(
              "rounded-2xl px-5",
              shellUtilityButtonClassName,
              closeButtonClassName,
            )}
          >
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return dialog;
  }

  return createPortal(dialog, document.body);
};
