import { useCallback, useContext, type JSX } from "react";
import { useAirJamContext } from "../context/air-jam-context";
import type { AirJamControllerRuntimeControls } from "../hooks/use-air-jam-controller";
import type { AirJamHostRuntimeControls } from "../hooks/use-air-jam-host";
import {
  AirJamErrorBoundary,
  type AirJamErrorBoundaryProps,
  type RuntimeErrorReportDraft,
} from "./air-jam-error-boundary";
import { devLogRuntimeErrorReporter } from "./browser-room";
import {
  controllerRuntimeContext,
  hostRuntimeContext,
} from "./runtime-owner-contexts";

type ConnectedRuntimeErrorBoundaryProps = Omit<
  AirJamErrorBoundaryProps,
  "reportError"
>;

/**
 * An error boundary inside a running host or controller: a crash report
 * names the room's code and instance, and a phone's seat, and goes to the
 * app's reporter. A crash before the room welcomed this surface is only
 * logged, since it belongs to no runtime session.
 */
export const ConnectedRuntimeErrorBoundary = ({
  role,
  ...props
}: ConnectedRuntimeErrorBoundaryProps): JSX.Element => {
  const { config } = useAirJamContext();
  const host = useContext(
    hostRuntimeContext,
  ) as AirJamHostRuntimeControls | null;
  const controller = useContext(
    controllerRuntimeContext,
  ) as AirJamControllerRuntimeControls | null;
  const reportError = useCallback(
    (draft: RuntimeErrorReportDraft): void => {
      const room = role === "host" ? host?.room : controller?.session;
      const code = room?.code;
      const instance = room?.instance;
      if (!code || !instance) return;
      const seat = controller?.session?.seat ?? undefined;
      (config.reportError ?? devLogRuntimeErrorReporter)({
        ...draft,
        roomId: code,
        instance,
        ...(role === "controller" && seat ? { seat } : {}),
      });
    },
    [config.reportError, controller, host, role],
  );

  return (
    <AirJamErrorBoundary {...props} role={role} reportError={reportError} />
  );
};
