"use client";

import { Button } from "@/components/ui/button";
import type { AirJamControllerApi } from "@air-jam/sdk";

// Socket transport diagnostics add no recovery guidance beyond the connection
// message. Keep them in SDK inspection/logs while preserving room-level errors.
const TRANSPORT_ERRORS = new Set([
  "transport close",
  "transport error",
  "ping timeout",
  "io client disconnect",
  "io server disconnect",
]);

interface ControllerConnectionSurfaceProps {
  controller: Pick<
    AirJamControllerApi,
    "connectionStatus" | "lastError" | "reconnect"
  >;
  roomId: string | null;
  onOpenRoomMenu: () => void;
}

export function ControllerConnectionSurface({
  controller,
  roomId,
  onOpenRoomMenu,
}: ControllerConnectionSurfaceProps) {
  const connecting =
    controller.connectionStatus === "connecting" ||
    controller.connectionStatus === "reconnecting";
  const lastError = controller.lastError?.trim();
  const visibleError =
    lastError && !TRANSPORT_ERRORS.has(lastError.toLowerCase())
      ? lastError
      : null;

  return (
    <div className="flex max-w-sm flex-col items-center gap-5 px-6 pt-20 pb-8 text-center">
      <div role="status" aria-live="polite">
        <h1 className="text-xl font-semibold text-white">
          {!roomId
            ? "Join a game"
            : connecting
              ? "Connecting to your room…"
              : "Unable to connect"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {!roomId
            ? "Scan the QR code on the game screen, or enter its room code."
            : connecting
              ? "Your controller will appear as soon as the room is connected."
              : "Check your connection and that the game screen is still open, then try again."}
        </p>
        {roomId && visibleError ? (
          <p className="mt-3 text-sm text-amber-200">{visibleError}</p>
        ) : null}
      </div>
      {roomId && !connecting ? (
        <Button size="touch" onClick={controller.reconnect}>
          Try again
        </Button>
      ) : null}
      <Button variant="outline" size="touch" onClick={onOpenRoomMenu}>
        {roomId ? "Change room" : "Enter room code"}
      </Button>
    </div>
  );
}
