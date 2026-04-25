import type { ControllerOrientation } from "../protocol";
import { createControllerPresentationSyncMessage } from "./controller-bridge";
import { readEmbeddedControllerRuntimeParams } from "./runtime-session-params";

export const publishEmbeddedControllerPresentation = (
  orientation: ControllerOrientation,
): void => {
  if (typeof window === "undefined" || window.parent === window) {
    return;
  }

  const runtimeParams = readEmbeddedControllerRuntimeParams();
  if (!runtimeParams) {
    return;
  }

  window.parent.postMessage(
    createControllerPresentationSyncMessage({
      orientation,
      arcadeSurface: runtimeParams.arcadeSurface,
    }),
    runtimeParams.topology.embedParentOrigin ?? "*",
  );
};
