import {
  ABNORMAL_CLOSE_CODE,
  PING_FRAME,
  PONG_FRAME,
  roomCloseCodes,
  roomCloseReasonForCode,
  type RoomAddress,
  type RoomCloseReason,
  type RoomConnector,
  type RoomLink,
  type RoomWireData,
} from "../room-protocol";
import { AIR_JAM_SDK_VERSION } from "../runtime/sdk-version";
import { systemRoomClock, type RoomClock } from "./clock";

export type RoomSessionStatus =
  | { readonly phase: "connecting" }
  /** The room server queued this host's room; `position` is its place. */
  | { readonly phase: "waiting"; readonly position: number }
  | { readonly phase: "open" }
  | { readonly phase: "reconnecting"; readonly attempt: number }
  /** For good: the room said not to come back, or the session's owner closed it. */
  | {
      readonly phase: "closed";
      readonly reason: RoomCloseReason | "owner";
    };

/**
 * Calls `wake` whenever the device may have its network back: it came back
 * online or the page became visible. Returns the call that stops listening.
 */
export type DeviceWakeEvents = (wake: () => void) => () => void;

/** The browser's own online and visibility events. */
export const browserDeviceWakeEvents: DeviceWakeEvents = (wake) => {
  const onVisibility = () => {
    if (document.visibilityState === "visible") wake();
  };
  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("online", wake);
    document.removeEventListener("visibilitychange", onVisibility);
  };
};

export interface RoomSessionOptions {
  readonly connector: RoomConnector;
  /** This device's key; see `createRoomKey`. The same key always gets the same place back. */
  readonly key: string;
  /** The room instance the key belongs to, when a page resumes a place it held before. */
  readonly instance?: string;
  readonly clock?: RoomClock;
  /** Jitter for reconnect delays, from 0 inclusive to 1 exclusive. */
  readonly random?: () => number;
  /** Defaults to the browser's events where there is a browser, and none elsewhere. */
  readonly deviceWakeEvents?: DeviceWakeEvents | null;
  /**
   * The client's own `ping`, which keeps carrier NAT mappings open and finds
   * a silently dead link. Null sends none, as a hidden tab's throttled timers
   * effectively do; the server's protocol-level pings still keep it.
   */
  readonly heartbeat?: {
    readonly intervalMs: number;
    readonly answerWithinMs: number;
  } | null;
  readonly retry?: {
    readonly firstDelayMs: number;
    readonly maximumDelayMs: number;
  };
}

export const DEFAULT_HEARTBEAT = {
  intervalMs: 20_000,
  answerWithinMs: 10_000,
} as const;
export const DEFAULT_RETRY = {
  firstDelayMs: 250,
  maximumDelayMs: 5_000,
} as const;
export const SESSION_SDK = `air-jam-sdk/${AIR_JAM_SDK_VERSION}`;

/** What a session tells the loop about its role. */
export interface SessionRole {
  /** Where the next link goes; a host that was given a code goes back to it. */
  address(): RoomAddress;
  hello(): string;
  receive(data: RoomWireData): void;
  /** The link ended; whatever waited on it is now unconfirmed. */
  lost(): void;
  status(status: RoomSessionStatus): void;
}

/**
 * Keeps one link to the room: says hello on every new link, sends the
 * heartbeat, and after a close either reconnects, with backoff and jitter
 * and at once when the device wakes, or stops for good when the close code
 * is terminal.
 */
export class SessionLink {
  private link: RoomLink | null = null;
  private welcomed = false;
  private attempt = 0;
  private cancelRetry: (() => void) | null = null;
  private cancelPing: (() => void) | null = null;
  private cancelAnswer: (() => void) | null = null;
  private stopWakeEvents: (() => void) | null = null;
  private current: RoomSessionStatus = { phase: "connecting" };
  readonly clock: RoomClock;
  private readonly random: () => number;
  private readonly heartbeat: RoomSessionOptions["heartbeat"];
  private readonly retry: NonNullable<RoomSessionOptions["retry"]>;

  constructor(
    private readonly options: RoomSessionOptions,
    private readonly role: SessionRole,
  ) {
    this.clock = options.clock ?? systemRoomClock;
    this.random = options.random ?? Math.random;
    this.heartbeat =
      options.heartbeat === undefined ? DEFAULT_HEARTBEAT : options.heartbeat;
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  get status(): RoomSessionStatus {
    return this.current;
  }

  get open(): boolean {
    return this.welcomed;
  }

  /** True while the link still holds data sent earlier, so fresher data should wait instead of queueing behind it. */
  get buffered(): boolean {
    return this.link?.buffered() ?? false;
  }

  start(): void {
    const wakeEvents =
      this.options.deviceWakeEvents === undefined
        ? typeof window === "undefined" || typeof document === "undefined"
          ? null
          : browserDeviceWakeEvents
        : this.options.deviceWakeEvents;
    this.stopWakeEvents = wakeEvents?.(() => this.deviceWoke()) ?? null;
    this.connect();
  }

  /** Sends on a welcomed link; false when there is none. */
  send(data: RoomWireData): boolean {
    if (!this.welcomed || !this.link) return false;
    this.link.send(data);
    return true;
  }

  /** The room welcomed this link. */
  markOpen(): void {
    this.welcomed = true;
    this.attempt = 0;
    this.setStatus({ phase: "open" });
  }

  waiting(position: number): void {
    this.setStatus({ phase: "waiting", position });
  }

  /** Ends the session from this side, for good. */
  close(): void {
    this.end("owner");
  }

  /** The room sent a frame this client cannot read: they do not speak the same protocol. */
  fail(): void {
    this.end("unsupported-version");
  }

  private end(reason: RoomCloseReason | "owner"): void {
    if (this.current.phase === "closed") return;
    this.link?.close();
    this.drop();
    this.finish(reason);
  }

  private connect(): void {
    if (this.attempt === 0) this.setStatus({ phase: "connecting" });
    const link: RoomLink = this.options.connector(this.role.address(), {
      open: () => {
        if (this.link !== link) return;
        link.send(this.role.hello());
        this.schedulePing();
      },
      message: (data) => {
        if (this.link !== link) return;
        this.heard();
        if (data !== PONG_FRAME) this.role.receive(data);
      },
      close: (code) => {
        if (this.link !== link) return;
        this.lost(code);
      },
    });
    this.link = link;
  }

  private lost(code: number): void {
    this.drop();
    const reason = roomCloseReasonForCode(code);
    if (reason !== null && roomCloseCodes[reason].terminal)
      return this.finish(reason);
    this.attempt += 1;
    this.setStatus({ phase: "reconnecting", attempt: this.attempt });
    const ceiling = Math.min(
      this.retry.maximumDelayMs,
      this.retry.firstDelayMs * 2 ** (this.attempt - 1),
    );
    const delay = ceiling / 2 + (this.random() * ceiling) / 2;
    this.cancelRetry = this.clock.at(this.clock.now() + delay, () => {
      this.cancelRetry = null;
      this.connect();
    });
  }

  /** Forgets the link and everything that ran on it. */
  private drop(): void {
    const hadLink = this.link !== null;
    this.link = null;
    this.welcomed = false;
    this.cancelPing?.();
    this.cancelPing = null;
    this.cancelAnswer?.();
    this.cancelAnswer = null;
    if (hadLink) this.role.lost();
  }

  private finish(reason: RoomCloseReason | "owner"): void {
    this.cancelRetry?.();
    this.cancelRetry = null;
    this.stopWakeEvents?.();
    this.stopWakeEvents = null;
    this.setStatus({ phase: "closed", reason });
  }

  private deviceWoke(): void {
    if (this.current.phase === "reconnecting" && this.cancelRetry) {
      this.cancelRetry();
      this.cancelRetry = null;
      this.connect();
    } else if (this.welcomed) this.ping();
  }

  private schedulePing(): void {
    if (!this.heartbeat) return;
    const { intervalMs } = this.heartbeat;
    this.cancelPing = this.clock.at(this.clock.now() + intervalMs, () => {
      this.cancelPing = null;
      this.ping();
      this.schedulePing();
    });
  }

  /** Asks the room to answer; a link that stays silent is dead. */
  private ping(): void {
    const link = this.link;
    if (!link || this.cancelAnswer) return;
    link.send(PING_FRAME);
    const answerWithinMs =
      this.heartbeat?.answerWithinMs ?? DEFAULT_HEARTBEAT.answerWithinMs;
    this.cancelAnswer = this.clock.at(this.clock.now() + answerWithinMs, () => {
      this.cancelAnswer = null;
      if (this.link !== link) return;
      link.close();
      this.lost(ABNORMAL_CLOSE_CODE);
    });
  }

  private heard(): void {
    this.cancelAnswer?.();
    this.cancelAnswer = null;
  }

  private setStatus(status: RoomSessionStatus): void {
    this.current = status;
    this.role.status(status);
  }
}
