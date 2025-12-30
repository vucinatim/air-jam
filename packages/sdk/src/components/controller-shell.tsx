import {
  Maximize,
  Minimize,
  Pause,
  Play,
  QrCode,
  RefreshCw,
} from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import { useFullscreen } from "../hooks/use-fullscreen";
import type { ConnectionStatus, PlayerProfile } from "../protocol";
import { cn } from "../utils/cn";
import { detectRunMode } from "../utils/mode";
import { PlayerAvatar } from "./player-avatar";
import { QRScannerDialog } from "./qr-scanner-dialog";
import { Button } from "./ui/button";

interface ControllerShellProps {
  roomId?: string | null;
  connectionStatus: ConnectionStatus;
  /** Optional forced orientation. If not set, no orientation enforcement is applied. */
  forceOrientation?: "portrait" | "landscape";
  children: ReactNode;
  gameState?: "paused" | "playing";
  onTogglePlayPause?: () => void;
  onReconnect?: (roomCode: string) => void;
  onRefresh?: () => void;
  customActions?: ReactNode;
}

const describeStatus = (status: ConnectionStatus): string => {
  switch (status) {
    case "connected":
      return "Connected to host";
    case "connecting":
      return "Connecting…";
    case "reconnecting":
      return "Trying to reconnect…";
    case "disconnected":
      return "Disconnected";
    case "idle":
    default:
      return "Idle";
  }
};

const orientationMatches = (
  required: "portrait" | "landscape" | undefined,
): boolean => {
  if (!required) return true;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  const matcher = window.matchMedia(`(orientation: ${required})`);
  return matcher.matches;
};

export const ControllerShell = ({
  roomId,
  connectionStatus,
  forceOrientation,
  children,
  gameState = "paused",
  onTogglePlayPause,
  onReconnect,
  onRefresh,
  customActions,
}: ControllerShellProps): JSX.Element => {
  const isChildMode = useMemo(() => detectRunMode() === "platform", []);
  const [isOrientationOk, setOrientationOk] = useState(() =>
    orientationMatches(forceOrientation),
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Get store from context
  const { store } = useAirJamContext();

  // Get current player info from connection store
  const { controllerId, players } = useStore(
    store,
    useShallow(
      (state: { controllerId: string | null; players: PlayerProfile[] }) => ({
        controllerId: state.controllerId,
        players: state.players,
      }),
    ),
  );

  // Find current player profile - must exist from server (single source of truth)
  const currentPlayer = useMemo(() => {
    if (!controllerId) return null;
    const found = players.find((p: PlayerProfile) => p.id === controllerId);

    // Only warn if we are fully connected and still can't find the player
    // This avoids race conditions during the initial connection handshake
    if (!found && connectionStatus === "connected" && players.length > 0) {
      // Optional: Debug log here if needed
    }
    return found || null;
  }, [controllerId, players, connectionStatus]);

  useEffect(() => {
    if (!forceOrientation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrientationOk(true);
      return;
    }

    const media = window.matchMedia(`(orientation: ${forceOrientation})`);
    const handleChange = (): void => setOrientationOk(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [forceOrientation]);

  const orientationOk = !forceOrientation ? true : isOrientationOk;

  const statusDotColor = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-500";
      case "connecting":
      case "reconnecting":
        return "bg-yellow-500";
      case "disconnected":
      default:
        return "bg-red-500";
    }
  }, [connectionStatus]);

  // In child mode, we only render the content and maybe orientation check.
  // The parent frame provides the shell (header, volume, etc).
  if (isChildMode) {
    return (
      <div className="dark">
        <div className="text-foreground relative flex h-dvh w-dvw touch-none flex-col overflow-hidden bg-transparent select-none">
          <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 select-none sm:p-4">
            {!orientationOk && (
              <div className="bg-background/95 absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center shadow-lg backdrop-blur-sm">
                <p className="text-card-foreground text-xl font-semibold">
                  Rotate your device
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  This game is best experienced in {forceOrientation}{" "}
                  orientation.
                </p>
              </div>
            )}
            <div
              className={cn(
                "h-full w-full select-none",
                !orientationOk && "pointer-events-none opacity-30",
              )}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dark">
      <div className="bg-background text-foreground relative flex h-dvh w-dvw touch-none flex-col overflow-hidden select-none">
        <header className="pointer-events-none sticky top-0 z-50 flex items-center justify-between border-b px-6 py-2">
          <div className="pointer-events-auto flex items-center gap-3">
            {typeof window !== "undefined" &&
              (currentPlayer || controllerId) && (
                <div
                  className="relative"
                  title={describeStatus(connectionStatus)}
                >
                  {currentPlayer ? (
                    <PlayerAvatar player={currentPlayer} size="sm" />
                  ) : controllerId ? (
                    <PlayerAvatar
                      player={{
                        id: controllerId,
                        label: "Player",
                      }}
                      size="sm"
                    />
                  ) : null}
                  {/* Black border circle - always visible behind */}
                  <span
                    className="absolute right-0 bottom-0 h-3 w-3 rounded-full bg-black"
                    aria-hidden="true"
                  />
                  {/* Colored status dot - on top */}
                  <span
                    className={cn(
                      "absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full",
                      statusDotColor,
                      connectionStatus === "connected" && "animate-pulse",
                    )}
                    aria-label={describeStatus(connectionStatus)}
                  />
                </div>
              )}
            <div>
              <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
                Room
              </p>
              <p className="text-foreground text-lg font-semibold">
                {typeof window !== "undefined" ? (roomId ?? "N/A") : "N/A"}
              </p>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-3">
            {customActions}
            {onRefresh && roomId && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onRefresh}
                disabled={
                  connectionStatus === "connecting" ||
                  connectionStatus === "reconnecting"
                }
                aria-label="Reconnect"
                title="Reconnect to room"
              >
                <RefreshCw
                  className={cn(
                    "h-5 w-5",
                    (connectionStatus === "connecting" ||
                      connectionStatus === "reconnecting") &&
                      "animate-spin",
                  )}
                />
              </Button>
            )}
            {onReconnect && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsScannerOpen(true)}
                aria-label="Scan QR code to reconnect"
                title="Scan QR code to reconnect"
              >
                <QrCode className="h-5 w-5" />
              </Button>
            )}
            {onTogglePlayPause && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onTogglePlayPause}
                aria-label={gameState === "playing" ? "Pause" : "Play"}
                title={gameState === "playing" ? "Pause" : "Play"}
              >
                {gameState === "playing" ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => toggleFullscreen()}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 select-none sm:p-4">
          <div className="bg-card/95 absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center shadow-lg backdrop-blur-sm">
            {!orientationOk && forceOrientation && (
              <div className="bg-background/95 absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center shadow-lg backdrop-blur-sm">
                <p className="text-card-foreground text-xl font-semibold">
                  Rotate your device
                </p>
                <p className="text-muted-foreground mt-2 text-sm">
                  This game is best experienced in {forceOrientation}{" "}
                  orientation.
                </p>
              </div>
            )}
            <div
              className={cn(
                "h-full w-full select-none",
                !orientationOk && "pointer-events-none opacity-30",
              )}
            >
              {children}
            </div>
          </div>
        </main>

        {onReconnect && (
          <QRScannerDialog
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScan={(roomCode) => {
              onReconnect(roomCode);
              setIsScannerOpen(false);
            }}
            currentRoomId={roomId}
          />
        )}
      </div>
    </div>
  );
};
