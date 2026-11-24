import {
  DEFAULT_ROOM_LIMITS,
  type HostHello,
  type RoomLimits,
} from "@air-jam/sdk/room-protocol";
import type { RoomLabels } from "./facts.js";
import { sameSecret } from "./secrets.js";

export interface RoomGateRequest {
  readonly hello: HostHello;
  /** The connection's origin header, when the transport has one. */
  readonly origin: string | null;
}

/**
 * The gate answers whether a host may open a room, before the room exists.
 * It runs in the host's front door, not in the room, so it may take its time.
 */
export type RoomGateDecision =
  | {
      readonly outcome: "open";
      readonly limits: RoomLimits;
      readonly labels: RoomLabels;
      readonly activity: string | null;
      readonly activityChangeable: boolean;
    }
  /** Admission is queued; the front door tells the host its place. */
  | { readonly outcome: "wait"; readonly position: number }
  | {
      readonly outcome: "refuse";
      readonly reason: "unauthorised" | "try-later";
    };

export interface RoomGate {
  admit(request: RoomGateRequest): RoomGateDecision | Promise<RoomGateDecision>;
}

const openDecision = (
  limits: RoomLimits,
  activityChangeable: boolean,
): RoomGateDecision => ({
  outcome: "open",
  limits,
  labels: {},
  activity: null,
  activityChangeable,
});

/** Admits every host, as a local or private server does. */
export const createOpenRoomGate = (
  limits: RoomLimits = DEFAULT_ROOM_LIMITS,
): RoomGate => ({
  admit: () => openDecision(limits, true),
});

/**
 * Admits hosts whose credential is the server's shared master key. Such a
 * host runs one game, so it may not change what is on screen.
 */
export const createMasterKeyRoomGate = (
  masterKey: string,
  limits: RoomLimits = DEFAULT_ROOM_LIMITS,
): RoomGate => {
  if (masterKey.length === 0)
    throw new Error("A master key gate needs a master key.");
  return {
    admit: ({ hello }) =>
      hello.credential !== undefined && sameSecret(hello.credential, masterKey)
        ? openDecision(limits, false)
        : { outcome: "refuse", reason: "unauthorised" },
  };
};
