import type { JSX, ReactNode } from "react";
import type { ConnectionStatus } from "../protocol";
import { cn } from "../utils/cn";
import { ConnectionStatusPill } from "./connection-status-pill";

export interface RuntimeShellHeaderProps {
  connectionStatus: ConnectionStatus;
  leftSlot: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
}

export const RuntimeShellHeader = ({
  connectionStatus,
  leftSlot,
  rightSlot,
  className,
}: RuntimeShellHeaderProps): JSX.Element => {
  return (
    <header
      className={cn(
        "flex items-center gap-3 border-b border-white/10 px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{leftSlot}</div>
      <ConnectionStatusPill status={connectionStatus} />
      {rightSlot ? <div className="flex shrink-0 items-center gap-2">{rightSlot}</div> : null}
    </header>
  );
};
