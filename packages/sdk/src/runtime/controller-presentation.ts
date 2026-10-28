import type { ControllerOrientation } from "../protocol";
import { createControllerPresentationSyncMessage } from "./controller-bridge";
import { controllerBridgeContext } from "./controller-bridge-context";
import { embeddedRuntimeParent } from "./embedded-parent";
import { readEmbeddedControllerRuntimeParams } from "./runtime-session-params";

export const publishEmbeddedControllerPresentation = (
  orientation: ControllerOrientation,
): void => {
  const runtimeParams = readEmbeddedControllerRuntimeParams();
  if (!runtimeParams) {
    return;
  }

  const parent = embeddedRuntimeParent(runtimeParams.topology);
  if (!parent) {
    return;
  }

  parent.window.postMessage(
    createControllerPresentationSyncMessage({
      orientation,
      ...controllerBridgeContext(runtimeParams),
    }),
    parent.origin,
  );
};
