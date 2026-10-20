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
  controllerId?: string;
  traceId?: string;
}

/** What lets a controller rejoin its seat after a reload. */
export interface ControllerRoomBinding {
  controllerId: string;
  resumeCapabilityToken: string;
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
  /** The store domain for stores that declare none. */
  readonly defaultStoreDomain: string;
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
  /** A fresh seed for a game's simulation randomness. */
  seed(): number;
  /**
   * Calls `onFrame` with a timestamp once per display frame until the
   * returned stop is called. Absent where nothing draws: the owner then
   * advances the simulation itself.
   */
  readonly frames?: (onFrame: (now: number) => void) => () => void;
}

/**
 * Everything a controller runtime needs from the platform it runs on: who the
 * page says it is, where it may remember its seat, and how it vibrates.
 */
export interface AirJamControllerEnvironment {
  /** Set when an embedding shell admitted this controller already. */
  readonly embedded: {
    roomId: RoomCode;
    controllerId: string;
    playerProfile?: { label?: string; avatarId?: string };
  } | null;
  /** A room the surrounding page asked for, such as `?room=`. */
  readonly requestedRoomId: string | null;
  /** A controller id the surrounding page asked for. */
  readonly requestedControllerId: string | null;
  /** A privileged controller capability carried by the join link. */
  readonly capabilityToken: string | null;
  /** This device's stable id; null when an embedding shell owns identity. */
  readonly deviceId: string | null;
  /** Preview controllers leave their room when their runtime stops. */
  readonly leaveOnStop: boolean;
  readonly runMode: RunMode;
  /** The store domain for stores that declare none. */
  readonly defaultStoreDomain: string;
  readBinding(
    roomId: string,
    controllerId?: string,
  ): ControllerRoomBinding | null;
  writeBinding(roomId: string, binding: ControllerRoomBinding): void;
  clearBinding(roomId: string, controllerId?: string): void;
  vibrate(pattern: number | number[]): void;
  transport(
    getSocket: (role: "controller") => AirJamSocket,
  ): AirJamRealtimeClient;
  emitDevEvent(detail: AirJamDevRuntimeEventDetail): void;
  setDevLogContext(context: AirJamDevLogContext): void;
}
