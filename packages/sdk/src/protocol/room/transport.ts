import type { RoomAddress } from "./addressing";

/** What travels over any room transport: text frames as strings, input as bytes. */
export type RoomWireData = string | Uint8Array;

/**
 * A client's side of one connection to a room server. Every transport (a
 * WebSocket, a frame's MessagePort, an in-process loopback) gives a session
 * this same shape, so the session's rules are written once.
 */
export interface RoomLink {
  send(data: RoomWireData): void;
  /** Ends the link from the client's side; its `close` handler is not called. */
  close(): void;
}

export interface RoomLinkHandlers {
  /** The link carries frames now; the client says hello. */
  open(): void;
  message(data: RoomWireData): void;
  /**
   * The link ended from the server's side or was lost. `code` is the close
   * code; a link that never opened or ended without one reports 1006, as a
   * WebSocket does.
   */
  close(code: number): void;
}

/** Opens one link to the room at `address`. */
export type RoomConnector = (
  address: RoomAddress,
  handlers: RoomLinkHandlers,
) => RoomLink;

/** A lost link, in WebSocket's own words. */
export const ABNORMAL_CLOSE_CODE = 1006;

/** One client connection as the room server sees it. */
export interface RoomConnection {
  send(data: RoomWireData): void;
  close(code: number): void;
}

export interface RoomConnectionHandlers {
  receive(data: RoomWireData): void;
  /** The connection ended, from either side. */
  closed(): void;
}

/**
 * Whatever serves rooms in memory takes connections through this, so a
 * network server and an in-process loopback reach the same wiring.
 * `origin` is the connecting page's origin when the transport has one.
 */
export interface RoomAcceptor {
  accept(
    address: RoomAddress,
    origin: string | null,
    connection: RoomConnection,
  ): RoomConnectionHandlers;
}
