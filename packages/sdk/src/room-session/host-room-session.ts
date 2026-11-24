import type { AirJamInput, AirJamInputState } from "../core/input";
import {
  DEFAULT_ROOM_LIMITS,
  encodeFrame,
  parseRoomToHostFrame,
  type ChannelCopy,
  type HostHello,
  type HostToRoomFrame,
  type RoomLimits,
  type RoomToHostFrame,
  type RoomWireData,
  type SeatId,
  type SeatView,
  type StateDocument,
} from "../room-protocol";
import { ChannelPublisher, type PublishOptions } from "./channel-state";
import { spacingForRate } from "./clock";
import { HostInputDecoder } from "./input-lane";
import { Listeners } from "./listeners";
import { Roster } from "./roster";
import {
  SESSION_SDK,
  SessionLink,
  type RoomSessionOptions,
  type RoomSessionStatus,
} from "./session-link";

export interface HostSessionOptions extends RoomSessionOptions {
  /**
   * The code to ask for, as a local server allows; omitted lets the room
   * server choose. A host given a code returns to it on every reconnect.
   */
  readonly code?: string;
  /** Opaque to the room; the server's gate reads it. */
  readonly credential?: string;
  /** How many players the game takes. */
  readonly seats: number;
  /** The game's declared controls; a host without them receives no input. */
  readonly input?: AirJamInput;
}

export interface RoomRequest {
  readonly seat: SeatId;
  readonly id: number;
  readonly channel: string;
  readonly name: string;
  readonly payload: unknown;
}

export interface HostSessionEvents extends Record<string, unknown> {
  status: RoomSessionStatus;
  seats: readonly SeatView[];
  input: { readonly seat: SeatId; readonly state: AirJamInputState };
  /** Answer each with `respond(request.seat, request.id, result)`. */
  request: RoomRequest;
}

/**
 * A game's screen in a room: it opens or reclaims the room, publishes the
 * room's channels, receives every seat's input and answers the phones'
 * requests. What the room should look like (seats wanted, locked, activity,
 * channels dropped) is asserted again after every welcome, so a change made
 * while the link was down is not lost.
 */
export class HostRoomSession {
  private readonly events = new Listeners<HostSessionEvents>();
  private readonly link: SessionLink;
  private readonly roster = new Roster();
  private readonly publisher = new ChannelPublisher();
  private readonly decoder: HostInputDecoder | null;
  private readonly droppedChannels = new Set<string>();
  private cancelState: (() => void) | null = null;
  private stateSentAt = Number.NEGATIVE_INFINITY;
  private currentCode: string | undefined;
  private currentInstance: string | undefined;
  private currentLimits: RoomLimits = DEFAULT_ROOM_LIMITS;
  private seatsWanted: number;
  private locked: boolean | null = null;
  private activity: { value: string | null } | null = null;
  private copies: readonly ChannelCopy[] = [];

  constructor(private readonly options: HostSessionOptions) {
    this.currentCode = options.code;
    this.currentInstance = options.instance;
    this.seatsWanted = options.seats;
    this.decoder = options.input ? new HostInputDecoder(options.input) : null;
    this.link = new SessionLink(options, {
      address: () => ({ role: "host", code: this.currentCode ?? null }),
      hello: () => this.hello(),
      receive: (data) => this.receive(data),
      lost: () => this.lost(),
      status: (status) => this.events.emit("status", status),
    });
    this.link.start();
  }

  readonly on = this.events.on.bind(this.events);

  get status(): RoomSessionStatus {
    return this.link.status;
  }
  get code(): string | undefined {
    return this.currentCode;
  }
  /** The room instance; store it with the key to reclaim the room after a reload. */
  get instance(): string | undefined {
    return this.currentInstance;
  }
  get seats(): readonly SeatView[] {
    return this.roster.list();
  }
  get limits(): RoomLimits {
    return this.currentLimits;
  }
  /**
   * Every channel the room held when it last welcomed this host, with its
   * fingerprint, so a reloading game can take its state back.
   */
  get roomCopies(): readonly ChannelCopy[] {
    return this.copies;
  }

  /**
   * The channel's latest document. Frames go out paced to the room's state
   * rate, so documents published in one turn travel as one frame. Throws
   * when the room could not hold the document.
   */
  publish(
    channel: string,
    document: StateDocument,
    options: PublishOptions = {},
  ): void {
    this.publisher.publish(channel, document, options, this.currentLimits);
    this.droppedChannels.delete(channel);
    this.pumpState();
  }

  drop(channel: string): void {
    this.publisher.drop(channel);
    if (!this.send({ type: "drop", channel }))
      this.droppedChannels.add(channel);
  }

  respond(seat: SeatId, id: number, result: unknown): void {
    this.send({ type: "response", seat, id, result });
  }

  /** A one-shot message to one seat or every phone; lost while the link is down. */
  signal(kind: string, payload?: unknown, seat?: SeatId): void {
    this.send({ type: "signal", kind, payload, ...(seat ? { seat } : {}) });
  }

  configure(room: {
    readonly seats?: number;
    readonly locked?: boolean;
  }): void {
    if (room.seats !== undefined) this.seatsWanted = room.seats;
    if (room.locked !== undefined) this.locked = room.locked;
    this.send({ type: "room", ...room });
  }

  /** Frees a seat and closes its phone for good. */
  remove(seat: SeatId): void {
    this.send({ type: "remove", seat });
  }

  /** What is on screen; only rooms whose gate allows it accept a change. */
  setActivity(activity: string | null): void {
    this.activity = { value: activity };
    this.send({ type: "activity", activity });
  }

  /** Closes the room for every device. */
  end(): void {
    if (!this.send({ type: "end" })) this.close();
  }

  /** Leaves the room to its host grace, as a closing page does. */
  close(): void {
    this.link.close();
  }

  private send(frame: HostToRoomFrame): boolean {
    return this.link.send(encodeFrame(frame));
  }

  private hello(): string {
    const hello: HostHello = {
      type: "hello",
      key: this.options.key,
      sdk: SESSION_SDK,
      seats: this.seatsWanted,
      ...(this.currentInstance === undefined
        ? {}
        : { instance: this.currentInstance }),
      ...(this.options.credential === undefined
        ? {}
        : { credential: this.options.credential }),
    };
    return encodeFrame(hello);
  }

  private receive(data: RoomWireData): void {
    if (typeof data !== "string") {
      for (const record of this.decoder?.decode(data) ?? [])
        this.events.emit("input", record);
      return;
    }
    const parsed = parseRoomToHostFrame(data);
    if (parsed.status === "unknown") return;
    if (parsed.status === "invalid") return this.link.fail();
    this.handle(parsed.frame);
  }

  private handle(frame: RoomToHostFrame): void {
    switch (frame.type) {
      case "welcome":
        return this.welcome(frame);
      case "wait":
        return this.link.waiting(frame.position);
      case "seat":
        this.roster.upsert(frame.seat);
        return this.events.emit("seats", this.roster.list());
      case "left":
        this.roster.remove(frame.seat);
        this.decoder?.forget(frame.seat);
        return this.events.emit("seats", this.roster.list());
      case "need":
        this.publisher.need(frame.channel);
        return this.pumpState();
      case "request":
        return this.events.emit("request", {
          seat: frame.seat,
          id: frame.id,
          channel: frame.channel,
          name: frame.name,
          payload: frame.payload,
        });
    }
  }

  private welcome(frame: Extract<RoomToHostFrame, { type: "welcome" }>): void {
    this.currentCode = frame.code;
    this.currentInstance = frame.instance;
    this.currentLimits = frame.limits;
    this.copies = frame.channels;
    this.roster.reset(frame.seats);
    this.publisher.rebase(frame.channels);
    this.link.markOpen();
    if (this.locked !== null && this.locked !== frame.locked)
      this.send({ type: "room", locked: this.locked });
    if (this.activity !== null && this.activity.value !== frame.activity)
      this.send({ type: "activity", activity: this.activity.value });
    for (const copy of frame.channels)
      if (this.droppedChannels.has(copy.channel))
        this.send({ type: "drop", channel: copy.channel });
    this.droppedChannels.clear();
    this.events.emit("seats", this.roster.list());
    this.pumpState();
  }

  private lost(): void {
    this.cancelState?.();
    this.cancelState = null;
  }

  private pumpState(): void {
    if (!this.link.open || this.cancelState || !this.publisher.hasDue()) return;
    const clock = this.link.clock;
    const at = Math.max(
      clock.now(),
      this.stateSentAt + spacingForRate(this.currentLimits.statesPerSecond),
    );
    this.cancelState = clock.at(at, () => {
      this.cancelState = null;
      const frame = this.publisher.take();
      if (frame && this.send(frame)) this.stateSentAt = clock.now();
      this.pumpState();
    });
  }
}
