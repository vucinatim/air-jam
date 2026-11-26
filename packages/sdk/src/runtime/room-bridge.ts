import { z } from "zod";
import { v2HandshakeSchema } from "../contracts/v2";
import {
  roomCloseCodes,
  type RoomConnector,
  type RoomLinkHandlers,
} from "../room-protocol";
import { createPortConnector, serveRoomPort } from "../room-session/port-link";
import {
  controllerBridgeContextSchema,
  type ControllerBridgeContext,
} from "./controller-bridge-context";
import { createBridgeHandshake } from "./iframe-bridge";
import { AIR_JAM_SDK_VERSION } from "./sdk-version";

/**
 * An embedded game or controller frame reaches its room through the page
 * that embeds it. The frame posts this request to its declared parent with
 * a `MessagePort`; the parent answers by serving the port, usually with a
 * scoped connector over its own session, or by refusing it. Everything after
 * is the room protocol's own frames on the port.
 */
export const AIRJAM_ROOM_BRIDGE_REQUEST = "AIRJAM_ROOM_BRIDGE_REQUEST" as const;

const roomBridgeRequestSchema = z
  .object({
    type: z.literal(AIRJAM_ROOM_BRIDGE_REQUEST),
    payload: z.intersection(
      z.object({
        handshake: v2HandshakeSchema,
        role: z.enum(["host", "controller"]),
      }),
      controllerBridgeContextSchema,
    ),
  })
  .strict();

export type RoomBridgeRequest = z.infer<
  typeof roomBridgeRequestSchema
>["payload"];

/**
 * The frame's side: asks the parent at `origin` to serve this frame's room,
 * and returns the connector the frame's session opens its links with. Links
 * wait on the port until the parent serves it.
 */
export const requestEmbeddingRoom = ({
  parent,
  role,
  context,
}: {
  parent: { window: Window; origin: string };
  role: RoomBridgeRequest["role"];
  context: ControllerBridgeContext;
}): RoomConnector => {
  const request = {
    type: AIRJAM_ROOM_BRIDGE_REQUEST,
    payload: {
      handshake: createBridgeHandshake({
        sdkVersion: AIR_JAM_SDK_VERSION,
        runtimeKind:
          role === "host"
            ? "arcade-host-iframe"
            : "harnessSessionId" in context
              ? "standalone-controller"
              : "arcade-controller-iframe",
        capabilityFlags: { roomBridge: true, hostReveal: role === "host" },
      }),
      role,
      ...context,
    },
  };
  // Nothing happens until a session opens a link: each link asks the parent
  // for its own port, and closing the link closes that port.
  return (address, handlers) => {
    const channel = new MessageChannel();
    parent.window.postMessage(request, parent.origin, [channel.port2]);
    const link = createPortConnector(channel.port1)(address, handlers);
    return {
      ...link,
      close: () => {
        link.close();
        channel.port1.close();
      },
    };
  };
};

/** The parent's side: a frame's request and the port it sent, or null when the message is not one. */
export const readRoomBridgeRequest = (
  event: MessageEvent,
): { request: RoomBridgeRequest; port: MessagePort } | null => {
  const parsed = roomBridgeRequestSchema.safeParse(event.data);
  const port = event.ports[0];
  if (!parsed.success || !port) return null;
  return { request: parsed.data.payload, port };
};

const refusingConnector: RoomConnector = (
  _address,
  handlers: RoomLinkHandlers,
) => {
  queueMicrotask(() => handlers.close(roomCloseCodes.unauthorised.code));
  return { send: () => {}, buffered: () => false, close: () => {} };
};

/** The parent's side for a request it will not serve: the frame's session ends as `unauthorised`. */
export const refuseRoomBridge = (port: MessagePort): void => {
  serveRoomPort(port, refusingConnector);
};
