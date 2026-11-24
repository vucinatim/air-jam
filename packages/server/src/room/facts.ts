import type { SeatId, SeatKind } from "@air-jam/sdk/room-protocol";

/** Whatever the gate attached when it admitted the host, such as app and game for hosted rooms. */
export type RoomLabels = Readonly<Record<string, string>>;

export type RoomCloseCause =
  | "ended"
  | "host-gone"
  | "expired"
  | "operator"
  | "restarting";

export type SeatLeaveCause = "left" | "removed" | "dropped";

export type RoomEvent =
  | { readonly kind: "opened" }
  | {
      readonly kind: "seat-joined";
      readonly seat: SeatId;
      readonly seatKind: SeatKind;
      /** The seat was held for a phone that dropped and has now returned. */
      readonly resumed: boolean;
    }
  | { readonly kind: "seat-dropped"; readonly seat: SeatId }
  | {
      readonly kind: "seat-left";
      readonly seat: SeatId;
      readonly cause: SeatLeaveCause;
    }
  | {
      readonly kind: "activity";
      readonly activity: string | null;
      /** The activity this one replaced, so the fact reads on its own. */
      readonly previous: string | null;
    }
  | { readonly kind: "closed"; readonly cause: RoomCloseCause };

/**
 * What a room reports as it happens. The public server logs facts; hosted
 * rooms deliver them to the platform as usage.
 */
export type RoomFact = {
  readonly at: number;
  readonly code: string;
  readonly instance: string;
  readonly labels: RoomLabels;
} & RoomEvent;
