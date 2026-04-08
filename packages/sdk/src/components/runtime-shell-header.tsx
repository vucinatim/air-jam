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
        "flex min-h-[3.5rem] items-center gap-3 border-b border-white/10 px-3 py-2 sm:px-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1">{leftSlot}</div>
      <div className="flex shrink-0 items-center gap-2">
        <ConnectionStatusPill status={connectionStatus} />
        {rightSlot ? (
          <div className="flex items-center justify-end">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </header>
  );
};
