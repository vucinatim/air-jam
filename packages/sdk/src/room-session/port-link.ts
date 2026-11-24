import { z } from "zod";
import {
  roomCodeSchema,
  type RoomConnector,
  type RoomLink,
  type RoomLinkHandlers,
} from "../room-protocol";

const wireDataSchema = z.union([
  z.string(),
  z.custom<Uint8Array>((value) => value instanceof Uint8Array),
]);
const linkIdSchema = z.number().int().positive();
const addressSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("host"), code: roomCodeSchema.nullable() }),
  z.object({ role: z.literal("phone"), code: roomCodeSchema }),
]);

/** From the embedded frame to the page that holds its connection. */
const toParentSchema = z.union([
  z.object({ link: linkIdSchema, open: addressSchema }),
  z.object({ link: linkIdSchema, data: wireDataSchema }),
  z.object({ link: linkIdSchema, close: z.literal(true) }),
]);
/** From the page back to the frame. */
const toFrameSchema = z.union([
  z.object({ link: linkIdSchema, opened: z.literal(true) }),
  z.object({ link: linkIdSchema, data: wireDataSchema }),
  z.object({ link: linkIdSchema, closed: z.number().int() }),
]);
type ToParent = z.infer<typeof toParentSchema>;
type ToFrame = z.infer<typeof toFrameSchema>;

/**
 * Links over a `MessagePort` that a parent page gave an embedded game or
 * controller frame. The frames on it are the room's own, carried verbatim;
 * the parent serves them with `serveRoomPort`.
 */
export const createPortConnector = (port: MessagePort): RoomConnector => {
  let nextLink = 1;
  const links = new Map<number, RoomLinkHandlers>();
  port.addEventListener("message", (event: MessageEvent) => {
    const parsed = toFrameSchema.safeParse(event.data);
    if (!parsed.success) return;
    const message = parsed.data;
    const handlers = links.get(message.link);
    if (!handlers) return;
    if ("opened" in message) handlers.open();
    else if ("data" in message) handlers.message(message.data);
    else {
      links.delete(message.link);
      handlers.close(message.closed);
    }
  });
  port.start();
  const post = (message: ToParent) => port.postMessage(message);
  return (address, handlers) => {
    const link = nextLink;
    nextLink += 1;
    links.set(link, handlers);
    post({ link, open: address });
    return {
      send: (data) => {
        if (links.has(link)) post({ link, data });
      },
      close: () => {
        if (links.delete(link)) post({ link, close: true });
      },
    };
  };
};

/**
 * The parent page's side of a frame's port: each link the frame opens is
 * opened with `connector`, and frames pass through unchanged. Returns the
 * call that closes every link and stops serving.
 */
export const serveRoomPort = (
  port: MessagePort,
  connector: RoomConnector,
): (() => void) => {
  const links = new Map<number, RoomLink>();
  const post = (message: ToFrame) => port.postMessage(message);
  const onMessage = (event: MessageEvent) => {
    const parsed = toParentSchema.safeParse(event.data);
    if (!parsed.success) return;
    const message = parsed.data;
    if ("open" in message) {
      if (links.has(message.link)) return;
      const id = message.link;
      links.set(
        id,
        connector(message.open, {
          open: () => post({ link: id, opened: true }),
          message: (data) => post({ link: id, data }),
          close: (code) => {
            links.delete(id);
            post({ link: id, closed: code });
          },
        }),
      );
    } else if ("data" in message) links.get(message.link)?.send(message.data);
    else {
      links.get(message.link)?.close();
      links.delete(message.link);
    }
  };
  port.addEventListener("message", onMessage);
  port.start();
  return () => {
    port.removeEventListener("message", onMessage);
    for (const link of links.values()) link.close();
    links.clear();
  };
};
