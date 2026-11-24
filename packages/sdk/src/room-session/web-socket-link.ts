import {
  roomPath,
  type RoomAddress,
  type RoomConnector,
} from "../room-protocol";

/**
 * Where the rooms served at `origin`, such as `wss://rooms.example.com` or
 * `http://localhost:4000`, take a WebSocket for `address`. Any path in the
 * origin is kept in front of the room's own path, for a relay that mounts
 * rooms under one.
 */
export const roomSocketUrls = (
  origin: string,
): ((address: RoomAddress) => URL) => {
  const base = new URL(origin);
  if (base.protocol === "http:") base.protocol = "ws:";
  if (base.protocol === "https:") base.protocol = "wss:";
  if (base.protocol !== "ws:" && base.protocol !== "wss:")
    throw new Error(`"${origin}" is not a WebSocket or HTTP origin.`);
  const prefix = base.pathname.replace(/\/$/, "");
  return (address) => {
    const url = new URL(base);
    url.pathname = `${prefix}${roomPath(address)}`;
    return url;
  };
};

/** Links over the platform's WebSocket to the rooms served at `origin`. */
export const createWebSocketConnector = (origin: string): RoomConnector => {
  const urlFor = roomSocketUrls(origin);
  return (address, handlers) => {
    const socket = new WebSocket(urlFor(address));
    socket.binaryType = "arraybuffer";
    let closedHere = false;
    socket.onopen = () => handlers.open();
    socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) =>
      handlers.message(
        typeof event.data === "string"
          ? event.data
          : new Uint8Array(event.data),
      );
    socket.onclose = (event) => {
      if (!closedHere) handlers.close(event.code);
    };
    return {
      send: (data) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(data);
      },
      close: () => {
        closedHere = true;
        socket.close(1000);
      },
    };
  };
};
