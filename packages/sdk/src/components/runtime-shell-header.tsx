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
        "flex flex-col gap-2 border-b border-white/10 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3",
        className,
      )}
    >
      <div className="min-w-0 w-full sm:flex-1">{leftSlot}</div>
      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-none sm:justify-end">
        <ConnectionStatusPill status={connectionStatus} />
        {rightSlot ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </header>
  );
};
