import {
  createControllerBridgeAttachMessage as createBridgeAttach,
  createControllerPresentationSyncMessage as createPresentationSync,
  parseControllerBridgeRequestMessage as parseBridgeRequest,
  parseControllerPresentationSyncMessage as parsePresentationSync,
  type ControllerBridgeSnapshot,
  type ControllerPresentationSyncMessage,
} from "../../runtime/controller-bridge";

export {
  AIRJAM_CONTROLLER_BRIDGE_EVENT,
  AIRJAM_CONTROLLER_BRIDGE_RESPONSE,
  AIRJAM_CONTROLLER_PRESENTATION_SYNC,
  createControllerBridgeCloseMessage,
  createControllerBridgeResponseMessage,
  parseControllerBridgeEmitMessage,
  parseControllerBridgeResponseMessage,
  type ControllerBridgeServerEventName,
} from "../../runtime/controller-bridge";
export type { ArcadeControllerPresentationSyncMessage as ControllerPresentationSyncMessage };

type ArcadeSnapshot = Extract<
  ControllerBridgeSnapshot,
  { arcadeSurface: unknown }
>;
type ArcadeControllerPresentationSyncMessage =
  ControllerPresentationSyncMessage & {
    payload: Extract<
      ControllerPresentationSyncMessage["payload"],
      { arcadeSurface: unknown }
    >;
  };

export const createControllerBridgeAttachMessage = (snapshot: ArcadeSnapshot) =>
  createBridgeAttach(snapshot);
export const createControllerPresentationSyncMessage = (
  payload: ArcadeControllerPresentationSyncMessage["payload"],
) => createPresentationSync(payload);

export const parseControllerBridgeRequestMessage = (value: unknown) => {
  const message = parseBridgeRequest(value);
  if (!message || !("arcadeSurface" in message.payload)) return null;
  return { ...message, payload: message.payload };
};
export const parseControllerPresentationSyncMessage = (
  value: unknown,
): ArcadeControllerPresentationSyncMessage | null => {
  const message = parsePresentationSync(value);
  if (!message || !("arcadeSurface" in message.payload)) return null;
  return { ...message, payload: message.payload };
};
