import type { JSX } from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConnectionStatus } from "../protocol";
import { cn } from "../utils/cn";

type OrientationRequirement = "portrait" | "landscape" | "any";

interface ControllerShellProps {
  roomId?: string | null;
  connectionStatus: ConnectionStatus;
  requiredOrientation?: OrientationRequirement;
  lastError?: string;
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
  lastError,
  children,
}: ControllerShellProps): JSX.Element => {
  const [isOrientationOk, setOrientationOk] = useState(() =>
    orientationMatches(requiredOrientation)
  );

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

  const statusTone = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "text-emerald-300";
      case "connecting":
      case "reconnecting":
        return "text-amber-300";
      default:
        return "text-rose-300";
    }
  }, [connectionStatus]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
            Room
          </p>
          <p className="text-lg font-semibold text-slate-100">
            {roomId ?? "N/A"}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className={cn("font-semibold", statusTone)}>
            {describeStatus(connectionStatus)}
          </p>
          {lastError ? (
            <p className="text-xs text-rose-200">{lastError}</p>
          ) : (
            <p className="text-xs text-slate-400">
              Stay on this page to control the game.
            </p>
          )}
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center p-4">
        {!orientationOk && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 px-6 text-center">
            <p className="text-xl font-semibold text-slate-50">
              Rotate your device
            </p>
            <p className="mt-2 text-sm text-slate-300">
              This game is best experienced in {requiredOrientation}{" "}
              orientation.
            </p>
          </div>
        )}
        <div
          className={cn(
            "w-full",
            !orientationOk && "pointer-events-none opacity-30"
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
};
