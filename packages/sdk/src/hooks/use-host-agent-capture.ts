import { useCallback, useContext, useLayoutEffect, useRef } from "react";
import {
  createHostCanvasCapture,
  type HostCanvasDraw,
} from "../agent/host-canvas-capture";
import { createAirJamDiagnosticError } from "../diagnostics";
import { hostRuntimeContext } from "../runtime/runtime-owner-contexts";
import type { AirJamHostRuntimeControls } from "./use-air-jam-host";

/**
 * Lets agents receive an image of what this host draws, such as its canvas.
 * What they read of the game comes from the simulation's `observe`.
 */
export function useHostAgentCapture(capture: HostCanvasDraw): () => void {
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
  useLayoutEffect(() => {
    current.current = capture;
  });
  const binding = useRef<ReturnType<typeof createHostCanvasCapture> | null>(
    null,
  );
  const { setObservationCapture } = runtime;
  useLayoutEffect(() => {
    binding.current = createHostCanvasCapture((canvas, options) =>
      current.current(canvas, options),
    );
    setObservationCapture(binding.current.capture);
    return () => {
      setObservationCapture(null);
      binding.current = null;
    };
  }, [setObservationCapture]);
  return useCallback(() => binding.current?.rendered(), []);
}
