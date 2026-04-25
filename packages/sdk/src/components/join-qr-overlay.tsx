import { useEffect, type JSX, type MouseEvent } from "react";
import { cn } from "../utils/cn";
import { RoomQrCode } from "./room-qr-code";
import {
  shellPanelClassName,
  shellUtilityButtonClassName,
} from "./shell-classes";
import { Button } from "./ui/button";

export interface JoinQrOverlayProps {
  open: boolean;
  value: string | null | undefined;
  roomId?: string | null;
  onClose?: () => void;
  title?: string;
  description?: string;
  className?: string;
  panelClassName?: string;
  qrClassName?: string;
  size?: number;
}

export const JoinQrOverlay = ({
  open,
  value,
  roomId,
  onClose,
  title = "Scan to join",
  description = "Scan with your phone to connect as a controller.",
  className,
  panelClassName,
  qrClassName,
  size = 440,
}: JoinQrOverlayProps): JSX.Element | null => {
  const joinUrlValue = value?.trim() ?? "";
  const hasJoinUrl = joinUrlValue.length > 0;

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

  if (!open) {
    return null;
  }

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={roomId ? `Join room ${roomId}` : title}
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-black/82 px-6 py-8 backdrop-blur-md",
        className,
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full max-w-xl flex-col items-center gap-6 px-6 py-7 text-center",
          shellPanelClassName,
          panelClassName,
        )}
        onClick={handlePanelClick}
      >
        <div className="space-y-1">
          <p className="text-[0.6875rem] font-semibold tracking-[0.22em] text-white/52 uppercase">
            {title}
          </p>
          {roomId ? (
            <p className="text-3xl font-semibold tracking-[0.12em] text-white uppercase tabular-nums">
              {roomId}
            </p>
          ) : null}
        </div>

        {hasJoinUrl ? (
          <RoomQrCode
            value={joinUrlValue}
            size={size}
            padding={2}
            foregroundColor="#111827"
            backgroundColor="#ffffff"
            className={cn("rounded-xl bg-white shadow-sm", qrClassName)}
            style={{
              width: "min(72vw, 26rem)",
              height: "auto",
              aspectRatio: "1 / 1",
            }}
            alt={
              roomId
                ? `QR code to join room ${roomId}`
                : "QR code to join as a controller"
            }
          />
        ) : (
          <div className="flex w-full max-w-[26rem] items-center justify-center rounded-xl border border-white/12 bg-white/6 px-5 py-10 text-sm leading-6 text-white/68">
            Join URL unavailable right now.
          </div>
        )}

        <p className="max-w-md text-sm leading-6 text-white/68">
          {description}
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className={cn("rounded-2xl px-5", shellUtilityButtonClassName)}
        >
          Close
        </Button>
      </div>
    </div>
  );
};
