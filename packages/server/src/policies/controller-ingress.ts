import {
  CONTROLLER_INGRESS_KEY_HEADER,
  CONTROLLER_INGRESS_ROOM_HEADER,
  roomCodeSchema,
} from "@air-jam/sdk/protocol";
import { timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

/** A private gateway binds its public connections to one controller room. */
export function controllerIngressRoom(
  headers: IncomingHttpHeaders,
  gatewayKey: string | undefined,
) {
  const key = headers[CONTROLLER_INGRESS_KEY_HEADER];
  const room = headers[CONTROLLER_INGRESS_ROOM_HEADER];
  if (key === undefined && room === undefined) return undefined;
  if (!gatewayKey || typeof key !== "string" || typeof room !== "string")
    throw new Error("Controller admission denied.");
  const expected = Buffer.from(gatewayKey);
  const received = Buffer.from(key);
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error("Controller admission denied.");
  return roomCodeSchema.parse(room);
}
