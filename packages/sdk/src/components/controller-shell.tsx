import type { JSX } from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ConnectionStatus } from "../protocol";
import { useFullscreen } from "../hooks/use-fullscreen";
import { cn } from "../utils/cn";

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
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case "connecting":
      case "reconnecting":
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 animate-spin text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        );
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-rose-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
    }
  }, [connectionStatus]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <header className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3">
        <div className="pointer-events-auto">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Room
          </p>
          <p className="text-lg font-semibold text-slate-100">
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
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center justify-center rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-800/50 hover:text-slate-100 active:scale-95"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2 sm:p-4">
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
