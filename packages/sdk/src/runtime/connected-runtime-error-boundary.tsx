import { useCallback, type JSX } from "react";
import { useAirJamSocket } from "../context/air-jam-context";
import type { RuntimeErrorReport } from "../protocol";
import {
  AirJamErrorBoundary,
  type AirJamErrorBoundaryProps,
} from "./air-jam-error-boundary";

type ConnectedRuntimeErrorBoundaryProps = Omit<
  AirJamErrorBoundaryProps,
  "reportError"
>;

export const ConnectedRuntimeErrorBoundary = ({
  role,
  ...props
}: ConnectedRuntimeErrorBoundaryProps): JSX.Element => {
  const socket = useAirJamSocket(role);
  const reportError = useCallback(
    (report: RuntimeErrorReport): void => {
      socket.emit("runtime:error_report", report, () => {
        // Reporting is best effort and must never disturb gameplay recovery.
      });
    },
    [socket],
  );

  return (
    <AirJamErrorBoundary {...props} role={role} reportError={reportError} />
  );
};
