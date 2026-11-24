import type { RoomCode, RunMode } from "../protocol";
import type { RuntimeErrorReporter } from "../protocol/runtime-reporting";
import type { SeatKind } from "../room-protocol";
import type {
  HostRoom,
  HostSessionOptions,
} from "../room-session/host-room-session";
import type {
  PhoneRoomSession,
  PhoneSessionOptions,
} from "../room-session/phone-room-session";
import type { AirJamDevRuntimeEventDetail } from "./dev-events";

/**
 * A host's place in its room, kept across reloads where the platform allows:
 * the key that reclaims it, the code and the room instance.
 */
export interface AirJamHostResume {
  key: string;
  code: string;
  instance: string;
}

export interface AirJamDevLogContext {
  role?: "host" | "controller";
  roomId?: string;
  controllerId?: string;
  traceId?: string;
}

/** What lets a phone resume its seat after a reload. */
/**
 * A phone's place in one room: its key, stored before it first connects so
 * a reload never makes a second seat, and the room instance once welcomed.
 */
export interface ControllerRoomBinding {
  key: string;
  instance?: string;
}

/**
 * Everything a host runtime needs from the platform it runs on. Browsers
 * provide it from the page; Node and tests provide it in memory.
 */
export interface AirJamHostEnvironment {
  /**
   * Set when an embedding shell owns the room and serves this host a view of
   * it; the join link is the shell's.
   */
  readonly embedded: { joinUrl?: string } | null;
  /** A room code the surrounding page asked for, such as `?room=`; a local server honours it. */
  readonly requestedRoomId: RoomCode | null;
  readonly runMode: RunMode;
  /** The store domain for stores that declare none. */
  readonly defaultStoreDomain: string;
  /** The channel the runtime publishes its presentation on. */
  readonly presentationChannel: string;
  /** Where agent tools and devtools find this runtime's control registry. */
  readonly controlTarget: object;
  /** Opens or reclaims this host's room over the platform's link to its rooms. */
  openRoom(
    options: Pick<
      HostSessionOptions,
      "key" | "code" | "instance" | "credential" | "seats" | "input"
    >,
  ): HostRoom;
  /** A new device key; see `createRoomKey`. */
  createKey(): string;
  readResume(): AirJamHostResume | null;
  writeResume(resume: AirJamHostResume | null): void;
  requestHostGrant(
    endpoint: string,
    appId: string | undefined,
  ): Promise<string>;
  controllerUrl(roomId: RoomCode): Promise<string>;
  reportError: RuntimeErrorReporter;
  emitDevEvent(detail: AirJamDevRuntimeEventDetail): void;
  setDevLogContext(context: AirJamDevLogContext): void;
  /** A fresh seed for a game's simulation randomness. */
  seed(): number;
  /**
   * The host's clock in milliseconds. Input leases and agent command
   * deadlines run on it, so a headless room keeps them on game time.
   */
  now(): number;
  /**
   * Calls `onFrame` with a timestamp once per display frame until the
   * returned stop is called. Absent where nothing draws: the owner then
   * advances the simulation itself.
   */
  readonly frames?: (onFrame: (now: number) => void) => () => void;
}

/**
 * Everything a controller runtime needs from the platform it runs on: which
 * room the page joins, where it may remember its seat, and how it vibrates.
 */
export interface AirJamControllerEnvironment {
  /** Set when an embedding shell holds this phone's seat and serves it a view of the room. */
  readonly embedded: {
    roomId: RoomCode;
    playerProfile?: { label?: string; avatarId?: string };
  } | null;
  /** A room the surrounding page asked for, such as `?room=`. */
  readonly requestedRoomId: string | null;
  /** What holds this seat: a person's phone, a preview on a screen or an agent. */
  readonly seatKind: SeatKind;
  /** Temporary local-seat name; the controller's ordinary nickname stays its own. */
  readonly localSeatLabel?: string | null;
  readonly runMode: RunMode;
  /** The store domain for stores that declare none. */
  readonly defaultStoreDomain: string;
  /** The channel the host publishes its presentation on. */
  readonly presentationChannel: string;
  /** Joins or resumes a seat over the platform's link to its rooms. */
  joinRoom(
    options: Pick<
      PhoneSessionOptions,
      "key" | "code" | "instance" | "kind" | "profile" | "input"
    >,
  ): PhoneRoomSession;
  createKey(): string;
  readBinding(roomId: string): ControllerRoomBinding | null;
  writeBinding(roomId: string, binding: ControllerRoomBinding): void;
  clearBinding(roomId: string): void;
  vibrate(pattern: number | number[]): void;
  /** Runs `callback` before the next display frame, so control changes send once per frame. */
  requestFrame(callback: () => void): void;
  reportError: RuntimeErrorReporter;
  emitDevEvent(detail: AirJamDevRuntimeEventDetail): void;
  setDevLogContext(context: AirJamDevLogContext): void;
}
