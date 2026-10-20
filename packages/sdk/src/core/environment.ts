import type { AirJamSocket } from "../context/socket-manager";
import type { RoomCode, RunMode } from "../protocol";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";

/** A host's resumable room, kept across reloads where the platform allows. */
export interface AirJamHostResume {
  roomId: string;
  token: string;
}

export interface AirJamDevLogContext {
  role?: "host" | "controller";
  roomId?: string;
  traceId?: string;
}

/**
 * Everything a host runtime needs from the platform it runs on. Browsers
 * provide it from the page; Node and tests provide it in memory.
 */
export interface AirJamHostEnvironment {
  /** Set when an embedding shell owns the room; the host joins it instead of creating one. */
  readonly embedded: { roomId: RoomCode; joinUrl?: string } | null;
  /** A room the surrounding page asked for, such as `?room=`. */
  readonly requestedRoomId: RoomCode | null;
  readonly runMode: RunMode;
  /** Where agent tools and devtools find this runtime's control registry. */
  readonly controlTarget: object;
  readResume(): AirJamHostResume | null;
  writeResume(resume: AirJamHostResume | null): void;
  requestHostGrant(
    endpoint: string,
    appId: string | undefined,
  ): Promise<string>;
  controllerUrl(
    roomId: RoomCode,
    capabilityToken: string | undefined,
  ): Promise<string>;
  transport(getSocket: (role: "host") => AirJamSocket): AirJamRealtimeClient;
  emitDevEvent(detail: AirJamDevRuntimeEventDetail): void;
  setDevLogContext(context: AirJamDevLogContext): void;
}
