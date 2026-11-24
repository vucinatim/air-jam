import type { RoomLimits, SeatId, SeatKind } from "@air-jam/sdk/room-protocol";
import type { SavedChannel } from "./channel-copies.js";
import type { RoomLabels } from "./facts.js";

/**
 * A room's durable state. Saved state outlives a deploy, so a newer release
 * must read what an older one wrote: raise the schema with every change and
 * migrate older ones when restoring.
 */
export const ROOM_SAVE_SCHEMA = 1;

/** Chosen by the host that holds the connection; opaque to the room. */
export type ConnectionId = string;

export interface SavedRoomRecord {
  readonly code: string;
  readonly instance: string;
  readonly hostKey: string;
  readonly limits: RoomLimits;
  readonly labels: RoomLabels;
  readonly activity: string | null;
  readonly activityChangeable: boolean;
  readonly openedAt: number;
  readonly seatsWanted: number;
  readonly locked: boolean;
  readonly nextSeatNumber: number;
  readonly hostConnection: ConnectionId | null;
  /** When the room closes unless its host returns; null while the host is in. */
  readonly hostAwayUntil: number | null;
}

export interface SavedSeat {
  readonly id: SeatId;
  readonly key: string;
  readonly kind: SeatKind;
  /** The player's own label, shown whenever no local seat label covers it. */
  readonly label: string;
  readonly localSeatLabel?: string;
  readonly avatarId?: string;
  readonly color: string;
  /** The page the seat's phone last joined from. */
  readonly page?: string;
  readonly connection: ConnectionId | null;
  /** When the seat is freed unless its phone returns; null while connected. */
  readonly holdUntil: number | null;
}

export interface SavedRoom {
  readonly schema: number;
  readonly room: SavedRoomRecord;
  readonly seats: Readonly<Record<SeatId, SavedSeat>>;
  readonly channels: Readonly<Record<string, SavedChannel>>;
}

/** The durable slices that changed since the last save; null marks one deleted. */
export interface SavedRoomChanges {
  readonly schema: number;
  readonly room?: SavedRoomRecord;
  readonly seats: Readonly<Record<SeatId, SavedSeat | null>>;
  readonly channels: Readonly<Record<string, SavedChannel | null>>;
}
