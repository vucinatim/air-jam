import type { JSX } from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConnectionStatus } from "../protocol";
import { useFullscreen } from "../hooks/use-fullscreen";
import { cn } from "../utils/cn";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Maximize,
  Minimize,
} from "lucide-react";

type OrientationRequirement = "portrait" | "landscape" | "any";

interface ControllerShellProps {
  roomId?: string | null;
  connectionStatus: ConnectionStatus;
  requiredOrientation?: OrientationRequirement;
  children: ReactNode;
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
}: ControllerShellProps): JSX.Element => {
  const [isOrientationOk, setOrientationOk] = useState(() =>
    orientationMatches(requiredOrientation)
  );
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
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      default:
        return <AlertCircle className="h-5 w-5 text-destructive" />;
    }
  }, [connectionStatus]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Room
          </p>
          <p className="text-lg font-semibold text-foreground">
            {roomId ?? "N/A"}
          </p>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <div
            className="flex items-center"
            title={describeStatus(connectionStatus)}
            aria-label={describeStatus(connectionStatus)}
          >
            {statusIcon}
          </div>
          <Button
            type="button"
            variant="ghost"
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

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
        {!orientationOk && (
          <Card className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 px-6 text-center border-0">
            <p className="text-xl font-semibold text-foreground">
              Rotate your device
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              This game is best experienced in {requiredOrientation}{" "}
              orientation.
            </p>
          </Card>
        )}
        <div
          className={cn(
            "h-full w-full",
            !orientationOk && "pointer-events-none opacity-30"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
};
