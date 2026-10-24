import {
  createControllerBridgeAttachMessage as createBridgeAttach,
  parseControllerBridgeRequestMessage as parseBridgeRequest,
  parseControllerPresentationSyncMessage as parsePresentationSync,
  type ControllerBridgeSnapshot,
  type ControllerPresentationSyncMessage,
} from "../../runtime/controller-bridge";

export {
  AIRJAM_CONTROLLER_BRIDGE_EVENT,
  createControllerBridgeCloseMessage,
  createControllerBridgeResponseMessage,
  parseControllerBridgeEmitMessage,
  type ControllerBridgeServerEventName,
} from "../../runtime/controller-bridge";

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
