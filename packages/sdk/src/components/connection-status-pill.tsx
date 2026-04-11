import type { ConnectionStatus } from "../protocol";
import { cn } from "../utils/cn";

const statusLabelByConnection: Record<ConnectionStatus, string> = {
  connected: "Live",
  connecting: "Syncing",
  reconnecting: "Syncing",
  disconnected: "Offline",
  idle: "Idle",
};

const statusToneByConnection: Record<ConnectionStatus, string> = {
  connected: "border-emerald-400/18 bg-emerald-400/8 text-emerald-50",
  connecting: "border-amber-400/18 bg-amber-400/8 text-amber-50",
  reconnecting: "border-amber-400/18 bg-amber-400/8 text-amber-50",
  disconnected: "border-rose-400/18 bg-rose-400/8 text-rose-50",
  idle: "border-white/10 bg-white/[0.05] text-white/78",
};

const statusDotToneByConnection: Record<ConnectionStatus, string> = {
  connected: "bg-emerald-300",
  connecting: "bg-amber-300",
  reconnecting: "bg-amber-300",
  disconnected: "bg-rose-300",
  idle: "bg-white/45",
};

export interface ConnectionStatusPillProps {
  status: ConnectionStatus;
  className?: string;
}

export const ConnectionStatusPill = ({
  status,
  className,
}: ConnectionStatusPillProps) => {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.16em] uppercase",
        statusToneByConnection[status],
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          statusDotToneByConnection[status],
        )}
        aria-hidden
      />
      {statusLabelByConnection[status]}
    </span>
  );
};
