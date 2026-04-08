import type { ConnectionStatus } from "../protocol";
import { cn } from "../utils/cn";

const statusLabelByConnection: Record<ConnectionStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Disconnected",
  idle: "Idle",
};

const statusToneByConnection: Record<ConnectionStatus, string> = {
  connected: "border-emerald-400/20 bg-emerald-400/10 text-emerald-50",
  connecting: "border-amber-400/20 bg-amber-400/10 text-amber-50",
  reconnecting: "border-amber-400/20 bg-amber-400/10 text-amber-50",
  disconnected: "border-rose-400/20 bg-rose-400/10 text-rose-50",
  idle: "border-white/10 bg-white/5 text-white/80",
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
        "inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.18em] uppercase",
        statusToneByConnection[status],
        className,
      )}
    >
      {statusLabelByConnection[status]}
    </span>
  );
};
