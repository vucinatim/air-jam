import {
  roomCloseReasonForCode,
  type RoomConnector,
} from "@air-jam/sdk/room-protocol";
import { roomSocketUrls } from "@air-jam/sdk/room-session";
import WebSocket from "ws";
import type { LinkProblem } from "./rooms-check-protocol.js";

const HANDSHAKE_TIMEOUT_MS = 10_000;

export interface CheckConnectorOptions {
  /** The rooms origin under check. */
  readonly url: string;
  /** Sent as every connection's Origin header, as the page's origin would be. */
  readonly origin?: string;
  /** Resolves when this connection may open; the check paces opens across every process. */
  readonly dial: () => Promise<void>;
  readonly onDialing?: () => void;
  /** A connection failed to open, or closed without this side asking. */
  readonly onProblem: (problem: LinkProblem) => void;
}

/**
 * Links as a phone or a screen would, over Node's `ws` so the check can send
 * the page's Origin and learn why a connection failed: the HTTP status of a
 * refused upgrade, the error of one that never answered, or the close code.
 */
export const createCheckConnector = (
  options: CheckConnectorOptions,
): RoomConnector => {
  const urlFor = roomSocketUrls(options.url);
  return (address, handlers) => {
    let socket: WebSocket | null = null;
    let closedHere = false;
    void options.dial().then(() => {
      if (closedHere) return;
      options.onDialing?.();
      const opening = new WebSocket(urlFor(address), {
        origin: options.origin,
        handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
      });
      socket = opening;
      let opened = false;
      let refusedStatus: number | null = null;
      let error: string | null = null;
      opening.on("unexpected-response", (_request, response) => {
        refusedStatus = response.statusCode ?? 0;
        opening.terminate();
      });
      opening.on("error", (cause: Error & { code?: string }) => {
        error ??= cause.code ?? cause.message;
      });
      opening.on("open", () => {
        opened = true;
        handlers.open();
      });
      opening.on("message", (data, isBinary) => {
        const bytes = Buffer.isBuffer(data)
          ? data
          : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)]);
        handlers.message(isBinary ? new Uint8Array(bytes) : bytes.toString());
      });
      opening.on("close", (code) => {
        if (closedHere) return;
        options.onProblem(
          opened
            ? { kind: "closed", code, reason: roomCloseReasonForCode(code) }
            : refusedStatus !== null
              ? { kind: "refused", status: refusedStatus }
              : { kind: "failed", error: error ?? `closed with ${code}` },
        );
        handlers.close(code);
      });
    });
    return {
      send: (data) => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(data);
      },
      close: () => {
        closedHere = true;
        if (socket?.readyState === WebSocket.OPEN) socket.close(1000);
        else socket?.terminate();
      },
    };
  };
};
