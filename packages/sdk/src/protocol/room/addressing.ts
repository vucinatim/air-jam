import { z } from "zod";

/**
 * One WebSocket per device. Role and room are in the path, so a front door or
 * relay can route and restrict a connection without reading a frame; the
 * path's version is the protocol's major version.
 */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 4;

/** Codes a front door assigns, and the longer ones a local host may ask for. */
export const roomCodeSchema = z.string().regex(/^[A-Z0-9]{4,8}$/);

export type RoomRole = "host" | "phone";

export type RoomAddress =
  | { readonly role: "host"; readonly code: string | null }
  | { readonly role: "phone"; readonly code: string };

export const roomPath = (address: RoomAddress): string =>
  address.role === "phone"
    ? `/v1/play/${address.code}`
    : address.code === null
      ? "/v1/host"
      : `/v1/host/${address.code}`;

export const parseRoomPath = (path: string): RoomAddress | null => {
  const match = /^\/v1\/(host|play)(?:\/([^/]+))?$/.exec(path);
  if (!match) return null;
  const [, segment, code] = match;
  if (code !== undefined && !roomCodeSchema.safeParse(code).success)
    return null;
  if (segment === "host") return { role: "host", code: code ?? null };
  return code === undefined ? null : { role: "phone", code };
};
