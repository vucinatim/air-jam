import { useContext, useEffect, useRef } from "react";
import type { HostObservationCapture } from "../core/host-runtime";
import { createAirJamDiagnosticError } from "../diagnostics";
import { hostRuntimeContext } from "../runtime/runtime-owner-contexts";
import type { AirJamHostRuntimeControls } from "./use-air-jam-host";

/**
 * Lets agents receive an image of what this host draws, such as its canvas.
 * What they read of the game comes from the simulation's `observe`.
 */
export function useHostAgentCapture(capture: HostObservationCapture): void {
  const runtime = useContext(hostRuntimeContext) as Pick<
    AirJamHostRuntimeControls,
    "setObservationCapture"
  > | null;
  if (!runtime)
    throw createAirJamDiagnosticError(
      "AJ_SCOPE_MISMATCH",
      "useHostAgentCapture requires a mounted host runtime boundary. Wrap the host tree with <airjam.Host>.",
      {
        hookName: "useHostAgentCapture",
        expectedScope: "host",
        receivedScope: "host",
      },
    );
  const current = useRef(capture);
  useEffect(() => {
    current.current = capture;
  });
  const { setObservationCapture } = runtime;
  useEffect(() => {
    setObservationCapture(() => current.current());
    return () => setObservationCapture(null);
  }, [setObservationCapture]);
}
