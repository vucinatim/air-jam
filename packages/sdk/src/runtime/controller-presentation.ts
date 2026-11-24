import { z } from "zod";
import {
  controllerOrientationSchema,
  type ControllerOrientation,
} from "../room-protocol";
import {
  controllerBridgeContext,
  withControllerBridgeContext,
  type ControllerBridgeContext,
} from "./controller-bridge-context";
import { embeddedRuntimeParent } from "./embedded-parent";
import { readEmbeddedControllerRuntimeParams } from "./runtime-session-params";

/**
 * An embedded controller tells the page around it how it wants the phone
 * held, so that page can rotate its own frame to match.
 */
export const AIRJAM_CONTROLLER_PRESENTATION_SYNC =
  "AIRJAM_CONTROLLER_PRESENTATION_SYNC" as const;

export interface ControllerPresentationSyncMessage {
  type: typeof AIRJAM_CONTROLLER_PRESENTATION_SYNC;
  payload: ControllerBridgeContext & { orientation: ControllerOrientation };
}

const presentationSyncSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_PRESENTATION_SYNC),
    payload: withControllerBridgeContext({
      orientation: controllerOrientationSchema,
    }),
  })
  .strict();

export const parseControllerPresentationSyncMessage = (
  value: unknown,
): ControllerPresentationSyncMessage | null => {
  const parsed = presentationSyncSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const publishEmbeddedControllerPresentation = (
  orientation: ControllerOrientation,
): void => {
  const runtimeParams = readEmbeddedControllerRuntimeParams();
  if (!runtimeParams) return;
  const parent = embeddedRuntimeParent(runtimeParams.topology);
  if (!parent) return;
  const message: ControllerPresentationSyncMessage = {
    type: AIRJAM_CONTROLLER_PRESENTATION_SYNC,
    payload: { orientation, ...controllerBridgeContext(runtimeParams) },
  };
  parent.window.postMessage(message, parent.origin);
};
