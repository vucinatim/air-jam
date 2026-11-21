import { useCallback, useContext, useLayoutEffect, useRef } from "react";
import type { HostCanvasDraw } from "../agent/host-canvas-capture";
import { createAirJamDiagnosticError } from "../diagnostics";
import { hostCaptureContext } from "../runtime/host-capture-context";

/**
 * Lets agents receive an image of what this host draws, such as its canvas.
 * What they read of the game comes from the simulation's `observe`.
 */
export function useHostAgentCapture(capture: HostCanvasDraw): () => void {
  const owner = useContext(hostCaptureContext);
  if (!owner)
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
  useLayoutEffect(() => {
    owner.setDraw((canvas, options) => current.current(canvas, options));
    return () => owner.setDraw(null);
  }, [owner]);
  return useCallback(() => owner.rendered(), [owner]);
}
