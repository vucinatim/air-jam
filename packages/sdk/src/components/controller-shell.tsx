import type { JSX } from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConnectionStatus } from "../protocol";
import { useFullscreen } from "../hooks/use-fullscreen";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Maximize,
  Minimize,
  Play,
  Pause,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { QRScannerDialog } from "./qr-scanner-dialog";

type OrientationRequirement = "portrait" | "landscape" | "any";

interface ControllerShellProps {
  roomId?: string | null;
  connectionStatus: ConnectionStatus;
  requiredOrientation?: OrientationRequirement;
  children: ReactNode;
  gameState?: "paused" | "playing";
  onTogglePlayPause?: () => void;
  onReconnect?: (roomCode: string) => void;
  onRefresh?: () => void;
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

const orientationMatches = (required: OrientationRequirement): boolean => {
  if (required === "any") return true;
  if (typeof window === "undefined" || !window.matchMedia) return true;
  const matcher = window.matchMedia(`(orientation: ${required})`);
  return matcher.matches;
};

export const ControllerShell = ({
  roomId,
  connectionStatus,
  requiredOrientation = "landscape",
  children,
  gameState = "paused",
  onTogglePlayPause,
  onReconnect,
  onRefresh,
}: ControllerShellProps): JSX.Element => {
  const [isOrientationOk, setOrientationOk] = useState(() =>
    orientationMatches(requiredOrientation)
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  useEffect(() => {
    if (requiredOrientation === "any") {
      return;
    }

    const media = window.matchMedia(`(orientation: ${requiredOrientation})`);
    const handleChange = (): void => setOrientationOk(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [requiredOrientation]);

  const orientationOk = requiredOrientation === "any" ? true : isOrientationOk;

  const statusIcon = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case "connecting":
      case "reconnecting":
        return (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        );
      default:
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  }, [connectionStatus]);

  return (
    <div className="relative flex h-dvh w-dvw flex-col overflow-hidden bg-background text-foreground select-none touch-none">
      <header className="pointer-events-none sticky top-0 z-50 flex items-center justify-between px-6 py-2 border-b">
        <div className="pointer-events-auto">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Room
          </p>
          <p className="text-lg font-semibold text-foreground">
            {roomId ?? "N/A"}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex items-center"
            title={describeStatus(connectionStatus)}
            aria-label={describeStatus(connectionStatus)}
          >
            {statusIcon}
          </Button>
          {onRefresh && roomId && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={connectionStatus === "connecting" || connectionStatus === "reconnecting"}
              aria-label="Reconnect"
              title="Reconnect to room"
            >
              <RefreshCw className={cn(
                "h-5 w-5",
                (connectionStatus === "connecting" || connectionStatus === "reconnecting") && "animate-spin"
              )} />
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
            onClick={toggleFullscreen}
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

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4 select-none">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/95 backdrop-blur-sm p-6 text-center shadow-lg">
          {!orientationOk && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6 text-center shadow-lg">
              <p className="text-xl font-semibold text-card-foreground">
                Rotate your device
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This game is best experienced in {requiredOrientation}{" "}
                orientation.
              </p>
            </div>
          )}
          <div
            className={cn(
              "h-full w-full select-none",
              !orientationOk && "pointer-events-none opacity-30"
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
  );
};
