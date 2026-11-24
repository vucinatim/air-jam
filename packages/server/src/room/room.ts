import {
  encodeFrame,
  encodeHostInputFrame,
  INPUT_FRAME_KIND,
  MAXIMUM_SEAT_NUMBER,
  parseHostHello,
  parseHostToRoomFrame,
  parsePhoneHello,
  parsePhoneToRoomFrame,
  PING_FRAME,
  PONG_FRAME,
  roomLimitsSchema,
  seatIdFromNumber,
  utf8ByteLength,
  type HostHello,
  type HostToRoomFrame,
  type PhoneHello,
  type PhoneToRoomFrame,
  type RoomCloseReason,
  type RoomLimits,
  type RoomRole,
  type RoomToHostFrame,
  type RoomToPhoneFrame,
  type SeatId,
  type SeatKind,
  type SeatView,
} from "@air-jam/sdk/room-protocol";
import { ChannelCopies } from "./channel-copies.js";
import { ConnectionBudget, type FrameLane } from "./connection-budget.js";
import type {
  RoomCloseCause,
  RoomEvent,
  RoomFact,
  RoomLabels,
  SeatLeaveCause,
} from "./facts.js";
import {
  ROOM_SAVE_SCHEMA,
  type ConnectionId,
  type SavedRoom,
  type SavedRoomChanges,
  type SavedRoomRecord,
  type SavedSeat,
} from "./saved-room.js";
import { sameSecret } from "./secrets.js";

export interface RoomSetup {
  readonly code: string;
  readonly instance: string;
  /** The opening host's key; only it can be the host of this room. */
  readonly hostKey: string;
  readonly limits: RoomLimits;
  readonly labels: RoomLabels;
  /** What is on screen as the room opens, such as the game a hosted grant names. */
  readonly activity: string | null;
  /** Whether the host may change it, as a launcher does when it starts a game. */
  readonly activityChangeable: boolean;
}

export type RoomEffect =
  | { readonly send: ConnectionId; readonly data: string | Uint8Array }
  | { readonly close: ConnectionId; readonly reason: RoomCloseReason }
  | { readonly fact: RoomFact };

export type RoomStopReason = "operator" | "restarting";

export interface RoomDescription {
  readonly code: string;
  readonly instance: string;
  readonly labels: RoomLabels;
  readonly openedAt: number;
  readonly closed: boolean;
  readonly activity: string | null;
  readonly limits: RoomLimits;
  readonly seatsWanted: number;
  readonly locked: boolean;
  readonly host: {
    readonly connected: boolean;
    readonly awayUntil: number | null;
  };
  readonly seats: ReadonlyArray<{
    readonly id: SeatId;
    readonly kind: SeatKind;
    readonly label: string;
    readonly connected: boolean;
    readonly holdUntil: number | null;
  }>;
  readonly channels: ReadonlyArray<{
    readonly channel: string;
    readonly revision: number;
    readonly weight: number;
  }>;
  /** Frames handled since this room was opened or restored. */
  readonly counters: Readonly<RoomCounters>;
}

interface RoomCounters {
  inputs: number;
  states: number;
  requests: number;
  signals: number;
  /** Frames over their lane's rate; a phone's latest input among them still arrives when the rate allows. */
  overRate: number;
  strikes: number;
}

interface Seat {
  readonly id: SeatId;
  readonly key: string;
  readonly kind: SeatKind;
  label: string;
  localSeatLabel?: string;
  avatarId?: string;
  readonly color: string;
  page?: string;
  connection: ConnectionId | null;
  holdUntil: number | null;
}

type Connection =
  | { readonly role: "host"; readonly budget: ConnectionBudget }
  | {
      readonly role: "phone";
      readonly seat: SeatId;
      readonly budget: ConnectionBudget;
      /**
       * Requests sent on this connection that the host has yet to answer; an
       * answer settles only one of these, so a reloaded phone, whose request
       * ids start again, never takes an answer meant for its earlier page.
       * Null for a connection restored from saved state, whose requests the
       * room no longer knows.
       */
      readonly requests: Set<number> | null;
    };

/** Requests a phone may have waiting for the host; past it the oldest answer is no longer expected. */
const MAXIMUM_WAITING_REQUESTS = 256;

const PLAYER_COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#c084fc",
  "#fb7185",
  "#4ade80",
  "#f87171",
  "#22d3ee",
  "#a855f7",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
] as const;

/**
 * One host, its seats and what flows between them. Bytes and the current time
 * go in; frames to send, connections to close and facts come out. The room
 * never waits, sets a timer, reads a clock or draws a random number: every
 * deadline is a timestamp in its state, and `nextWake` says when the host
 * should call `wake`. Every entry point first applies the deadlines that have
 * passed, so a late wake changes nothing a device can observe.
 */
export class Room {
  private readonly seats = new Map<SeatId, Seat>();
  private readonly seatsByKey = new Map<string, SeatId>();
  private readonly connections = new Map<ConnectionId, Connection>();
  private readonly channels: ChannelCopies;
  private readonly counters: RoomCounters = {
    inputs: 0,
    states: 0,
    requests: 0,
    signals: 0,
    overRate: 0,
    strikes: 0,
  };
  /** Each phone's latest input that arrived over its rate, delivered when its rate window ends. */
  private readonly heldInputs = new Map<ConnectionId, Uint8Array>();
  private hostConnection: ConnectionId | null = null;
  private hostAwayUntil: number | null;
  private activity: string | null;
  private seatsWanted: number;
  private locked = false;
  private nextSeatNumber = 1;
  private closed = false;
  private roomChanged = true;
  private readonly changedSeats = new Set<SeatId>();
  private readonly changedChannels = new Set<string>();
  private effects: RoomEffect[] = [];

  private constructor(
    private readonly code: string,
    private readonly instance: string,
    private readonly hostKey: string,
    private readonly limits: RoomLimits,
    private readonly labels: RoomLabels,
    private readonly activityChangeable: boolean,
    private readonly openedAt: number,
    activity: string | null,
  ) {
    this.channels = new ChannelCopies(limits);
    this.activity = activity;
    // No player is admitted until the host has said how many its game takes.
    this.seatsWanted = 0;
    this.hostAwayUntil = openedAt + limits.hostGraceMs;
  }

  static open(
    setup: RoomSetup,
    now: number,
  ): { room: Room; effects: RoomEffect[] } {
    const room = new Room(
      setup.code,
      setup.instance,
      setup.hostKey,
      roomLimitsSchema.parse(setup.limits),
      setup.labels,
      setup.activityChangeable,
      now,
      setup.activity,
    );
    const effects = room.run(now, () => room.fact(now, { kind: "opened" }));
    return { room, effects };
  }

  /**
   * Rebuilds a room from its saved state and the connections still open, as
   * a Durable Object does when it wakes. Devices whose connection closed
   * while the room was away are treated as having dropped now. State saved by
   * a newer release cannot be read: every connection is told the server is
   * restarting and there is no room.
   */
  static restore(
    saved: SavedRoom,
    live: readonly ConnectionId[],
    now: number,
  ): { room: Room | null; effects: RoomEffect[] } {
    if (saved.schema > ROOM_SAVE_SCHEMA)
      return {
        room: null,
        effects: live.map((connection) => ({
          close: connection,
          reason: "restarting",
        })),
      };
    const record = saved.room;
    const room = new Room(
      record.code,
      record.instance,
      record.hostKey,
      record.limits,
      record.labels,
      record.activityChangeable,
      record.openedAt,
      record.activity,
    );
    room.seatsWanted = record.seatsWanted;
    room.locked = record.locked;
    room.nextSeatNumber = record.nextSeatNumber;
    room.hostAwayUntil = record.hostAwayUntil;
    room.hostConnection = record.hostConnection;
    for (const seat of Object.values(saved.seats)) {
      room.seats.set(seat.id, { ...seat });
      room.seatsByKey.set(seat.key, seat.id);
    }
    for (const channel of Object.values(saved.channels))
      room.channels.restore(channel);
    room.roomChanged = false;
    // Bind what is still open before applying deadlines, so nothing is sent
    // to a connection that closed while the room was away.
    room.reconnect(new Set(live), now);
    room.settle(now);
    // Input held over the rate is not saved, so phones send their controls again.
    if (room.hostConnection !== null)
      room.toPhones({ type: "host", present: true });
    return { room, effects: room.effects };
  }

  /**
   * A device's first frame. `role` comes from the path it connected to, so
   * the path alone decides who may act as a host.
   */
  connect(
    connection: ConnectionId,
    role: RoomRole,
    hello: string,
    now: number,
  ): RoomEffect[] {
    return this.run(now, () => {
      if (this.connections.has(connection))
        throw new Error(`Connection ${connection} already said hello.`);
      if (this.closed) return this.closeConnection(connection, "closed");
      if (utf8ByteLength(hello) > this.limits.frameBytes)
        return this.closeConnection(connection, "limits-broken");
      if (role === "host") {
        const frame = parseHostHello(hello);
        if (!frame)
          return this.closeConnection(connection, "unsupported-version");
        this.connectHost(connection, frame, now);
      } else {
        const frame = parsePhoneHello(hello);
        if (!frame)
          return this.closeConnection(connection, "unsupported-version");
        this.connectPhone(connection, frame, now);
      }
    });
  }

  receive(
    connection: ConnectionId,
    data: string | Uint8Array,
    now: number,
  ): RoomEffect[] {
    return this.run(now, () => {
      const entry = this.connections.get(connection);
      if (!entry) return;
      if (data === PING_FRAME) {
        if (!entry.budget.spend("frame", now))
          return this.breakLimits(connection, entry, now);
        return this.send(connection, PONG_FRAME);
      }
      if (typeof data === "string") {
        if (entry.role === "host")
          this.receiveHostText(connection, entry, data, now);
        else this.receivePhoneText(connection, entry, data, now);
      } else if (entry.role === "phone") {
        this.receiveInput(connection, entry, data, now);
      } else this.ignore(connection, entry, "unknown", "frame", now);
    });
  }

  disconnect(connection: ConnectionId, now: number): RoomEffect[] {
    return this.run(now, () => {
      const entry = this.connections.get(connection);
      if (!entry) return;
      this.connections.delete(connection);
      this.release(entry, now);
    });
  }

  wake(now: number): RoomEffect[] {
    return this.run(now, () => {});
  }

  stop(reason: RoomStopReason, now: number): RoomEffect[] {
    return this.run(now, () => {
      if (!this.closed) this.closeRoom(reason, now);
    });
  }

  /** The earliest moment something is due, or null once the room is closed. */
  nextWake(): number | null {
    if (this.closed) return null;
    let earliest = this.openedAt + this.limits.maximumAgeMs;
    if (this.hostAwayUntil !== null)
      earliest = Math.min(earliest, this.hostAwayUntil);
    for (const seat of this.seats.values())
      if (seat.holdUntil !== null)
        earliest = Math.min(earliest, seat.holdUntil);
    for (const connection of this.heldInputs.keys()) {
      const entry = this.connections.get(connection);
      if (entry) earliest = Math.min(earliest, entry.budget.windowEndsAt);
    }
    const ask = this.hostConnection === null ? null : this.channels.nextAsk();
    if (ask !== null) earliest = Math.min(earliest, ask);
    return earliest;
  }

  save(): SavedRoomChanges | null {
    if (
      !this.roomChanged &&
      this.changedSeats.size === 0 &&
      this.changedChannels.size === 0
    )
      return null;
    const changes: SavedRoomChanges = {
      schema: ROOM_SAVE_SCHEMA,
      ...(this.roomChanged ? { room: this.record() } : {}),
      seats: Object.fromEntries(
        [...this.changedSeats].map((id) => {
          const seat = this.seats.get(id);
          return [id, seat ? this.savedSeat(seat) : null];
        }),
      ),
      channels: Object.fromEntries(
        [...this.changedChannels].map((channel) => [
          channel,
          this.channels.saved(channel),
        ]),
      ),
    };
    this.roomChanged = false;
    this.changedSeats.clear();
    this.changedChannels.clear();
    return changes;
  }

  describe(): RoomDescription {
    return {
      code: this.code,
      instance: this.instance,
      labels: this.labels,
      openedAt: this.openedAt,
      closed: this.closed,
      activity: this.activity,
      limits: this.limits,
      seatsWanted: this.seatsWanted,
      locked: this.locked,
      host: {
        connected: this.hostConnection !== null,
        awayUntil: this.hostAwayUntil,
      },
      seats: [...this.seats.values()].map((seat) => ({
        id: seat.id,
        kind: seat.kind,
        label: seat.localSeatLabel ?? seat.label,
        connected: seat.connection !== null,
        holdUntil: seat.holdUntil,
      })),
      channels: this.channels.describe(),
      counters: { ...this.counters },
    };
  }

  private run(now: number, work: () => void): RoomEffect[] {
    this.effects = [];
    this.settle(now);
    work();
    // A deadline of zero length, such as an agent seat's hold, is due at once.
    this.settle(now);
    return this.effects;
  }

  private settle(now: number): void {
    if (this.closed) return;
    // A late wake closes for whichever deadline passed first.
    const expiresAt = this.openedAt + this.limits.maximumAgeMs;
    const hostGoneAt = this.hostAwayUntil ?? Number.POSITIVE_INFINITY;
    if (now >= Math.min(expiresAt, hostGoneAt))
      return hostGoneAt < expiresAt
        ? this.closeRoom("host-gone", hostGoneAt)
        : this.closeRoom("expired", expiresAt);
    for (const seat of [...this.seats.values()])
      if (seat.holdUntil !== null && now >= seat.holdUntil)
        this.freeSeat(seat, "dropped", seat.holdUntil);
    for (const [connection, frame] of [...this.heldInputs]) {
      const entry = this.connections.get(connection);
      if (entry?.role !== "phone") {
        this.heldInputs.delete(connection);
        continue;
      }
      if (now < entry.budget.windowEndsAt) continue;
      this.heldInputs.delete(connection);
      if (entry.budget.fits("input", now)) this.forwardInput(entry, frame);
    }
    if (this.hostConnection !== null)
      for (const channel of this.channels.due(now))
        this.send(this.hostConnection, { type: "need", channel });
  }

  private reconnect(live: ReadonlySet<ConnectionId>, now: number): void {
    const hostDropped =
      this.hostConnection !== null && !live.has(this.hostConnection);
    if (hostDropped) this.hostConnection = null;
    const droppedSeats: Seat[] = [];
    for (const seat of this.seats.values())
      if (seat.connection !== null && !live.has(seat.connection)) {
        seat.connection = null;
        droppedSeats.push(seat);
      }
    if (this.hostConnection !== null)
      this.connections.set(this.hostConnection, {
        role: "host",
        budget: new ConnectionBudget(this.limits, now),
      });
    for (const seat of this.seats.values())
      if (seat.connection !== null)
        this.connections.set(seat.connection, {
          role: "phone",
          seat: seat.id,
          budget: new ConnectionBudget(this.limits, now),
          requests: null,
        });
    if (hostDropped) this.hostLeft(now);
    for (const seat of droppedSeats) this.seatLeft(seat, now);
  }

  private connectHost(
    connection: ConnectionId,
    hello: HostHello,
    now: number,
  ): void {
    if (hello.instance !== undefined && hello.instance !== this.instance)
      return this.closeConnection(connection, "not-found");
    if (!sameSecret(hello.key, this.hostKey))
      return this.closeConnection(connection, "unauthorised");
    if (this.hostConnection !== null) {
      this.connections.delete(this.hostConnection);
      this.closeConnection(this.hostConnection, "replaced");
    }
    this.hostConnection = connection;
    this.hostAwayUntil = null;
    this.connections.set(connection, {
      role: "host",
      budget: new ConnectionBudget(this.limits, now),
    });
    this.seatsWanted = Math.min(hello.seats, this.limits.seats);
    this.roomChanged = true;
    this.send(connection, {
      type: "welcome",
      code: this.code,
      instance: this.instance,
      seats: this.seatViews(),
      channels: this.channels.forHost(),
      limits: this.limits,
      features: [],
      seatsWanted: this.seatsWanted,
      locked: this.locked,
      activity: this.activity,
    });
    // Phones send their controls again to every new host connection, even
    // one that replaced a connection the room still thought was open.
    this.toPhones({ type: "host", present: true });
  }

  private connectPhone(
    connection: ConnectionId,
    hello: PhoneHello,
    now: number,
  ): void {
    if (hello.instance !== undefined && hello.instance !== this.instance)
      return this.closeConnection(connection, "not-found");
    const existingId = this.seatsByKey.get(hello.key);
    let seat =
      existingId === undefined ? undefined : this.seats.get(existingId);
    let resumed: boolean | null = null;
    let inputBaseline = false;
    if (seat) {
      inputBaseline = hello.page !== seat.page;
      if (seat.connection !== null) {
        this.connections.delete(seat.connection);
        this.closeConnection(seat.connection, "replaced");
      } else resumed = true;
      const profile = hello.profile ?? {};
      if (profile.label !== undefined) seat.label = profile.label;
      if (profile.avatarId !== undefined) seat.avatarId = profile.avatarId;
      seat.localSeatLabel = profile.localSeatLabel;
    } else {
      // A resume proves a seat that no longer exists; it never makes one.
      if (hello.instance !== undefined)
        return this.closeConnection(connection, "not-found");
      if (
        this.locked ||
        this.seats.size >= this.seatsWanted ||
        this.nextSeatNumber > MAXIMUM_SEAT_NUMBER
      )
        return this.closeConnection(connection, "full");
      seat = this.createSeat(hello);
      resumed = false;
    }
    seat.page = hello.page;
    seat.connection = connection;
    seat.holdUntil = null;
    this.changedSeats.add(seat.id);
    this.connections.set(connection, {
      role: "phone",
      seat: seat.id,
      budget: new ConnectionBudget(this.limits, now),
      requests: new Set(),
    });
    this.send(connection, {
      type: "welcome",
      code: this.code,
      instance: this.instance,
      seat: seat.id,
      seats: this.seatViews(),
      channels: this.channels.forSeat(seat.id),
      limits: this.limits,
      features: [],
      host: this.hostConnection !== null,
    });
    this.announceSeat(seat, seat.id, inputBaseline);
    if (resumed !== null)
      this.fact(now, {
        kind: "seat-joined",
        seat: seat.id,
        seatKind: seat.kind,
        resumed,
      });
  }

  private createSeat(hello: PhoneHello): Seat {
    const seatNumber = this.nextSeatNumber;
    this.nextSeatNumber += 1;
    this.roomChanged = true;
    const colorsInUse = new Set(
      [...this.seats.values()].map((seat) => seat.color),
    );
    const seat: Seat = {
      id: seatIdFromNumber(seatNumber),
      key: hello.key,
      kind: hello.kind,
      label: hello.profile?.label ?? `Player ${seatNumber}`,
      localSeatLabel: hello.profile?.localSeatLabel,
      avatarId: hello.profile?.avatarId,
      color:
        PLAYER_COLORS.find((color) => !colorsInUse.has(color)) ??
        PLAYER_COLORS[(seatNumber - 1) % PLAYER_COLORS.length] ??
        PLAYER_COLORS[0],
      connection: null,
      holdUntil: null,
    };
    this.seats.set(seat.id, seat);
    this.seatsByKey.set(seat.key, seat.id);
    return seat;
  }

  private receiveHostText(
    connection: ConnectionId,
    entry: Connection,
    text: string,
    now: number,
  ): void {
    const bytes = utf8ByteLength(text);
    if (bytes > this.limits.stateBytes)
      return this.breakLimits(connection, entry, now);
    const parsed = parseHostToRoomFrame(text);
    if (parsed.status !== "frame")
      return this.ignore(connection, entry, parsed.status, "frame", now);
    const frame = parsed.frame;
    if (frame.type !== "state" && bytes > this.limits.frameBytes)
      return this.breakLimits(connection, entry, now);
    const admission = entry.budget.admit(
      frame.type === "state" ? "state" : "frame",
      now,
    );
    if (admission === "flooded")
      return this.breakLimits(connection, entry, now);
    if (admission === "over-rate") {
      this.counters.overRate += 1;
      // A dropped state frame leaves the room's copy behind the host's.
      if (frame.type === "state")
        this.channels.fellBehind(frame.channel, entry.budget.windowEndsAt);
      return;
    }
    this.handleHostFrame(connection, entry, frame, now);
  }

  private handleHostFrame(
    connection: ConnectionId,
    entry: Connection,
    frame: HostToRoomFrame,
    now: number,
  ): void {
    switch (frame.type) {
      case "state": {
        this.counters.states += 1;
        const outcome = this.channels.receive(frame, now);
        if (outcome.kind === "applied") {
          this.changedChannels.add(outcome.channel);
          for (const seat of this.seats.values())
            if (seat.connection !== null)
              this.send(seat.connection, outcome.frameFor(seat.id));
        } else if (outcome.kind === "need") {
          this.send(connection, { type: "need", channel: outcome.channel });
        } else if (outcome.kind !== "waiting") {
          this.breakLimits(connection, entry, now);
        }
        return;
      }
      case "response": {
        const asker = this.seats.get(frame.seat)?.connection ?? null;
        const phone = asker === null ? undefined : this.connections.get(asker);
        if (
          asker !== null &&
          phone?.role === "phone" &&
          (phone.requests === null || phone.requests.delete(frame.id))
        )
          this.send(asker, {
            type: "response",
            id: frame.id,
            result: frame.result,
          });
        return;
      }
      case "signal": {
        this.counters.signals += 1;
        const signal = {
          type: "signal",
          kind: frame.kind,
          payload: frame.payload,
        } as const;
        if (frame.seat === undefined) return this.toPhones(signal);
        const seat = this.seats.get(frame.seat);
        if (seat?.connection) this.send(seat.connection, signal);
        return;
      }
      case "room":
        if (frame.seats !== undefined)
          this.seatsWanted = Math.min(frame.seats, this.limits.seats);
        if (frame.locked !== undefined) this.locked = frame.locked;
        this.roomChanged = true;
        return;
      case "remove": {
        const seat = this.seats.get(frame.seat);
        if (!seat) return;
        if (seat.connection !== null) {
          this.connections.delete(seat.connection);
          this.closeConnection(seat.connection, "removed");
        }
        return this.freeSeat(seat, "removed", now);
      }
      case "drop":
        if (!this.channels.drop(frame.channel)) return;
        this.changedChannels.add(frame.channel);
        return this.toPhones({ type: "drop", channel: frame.channel });
      case "activity": {
        if (!this.activityChangeable)
          return this.strike(connection, entry, now);
        if (frame.activity === this.activity) return;
        const previous = this.activity;
        this.activity = frame.activity;
        this.roomChanged = true;
        return this.fact(now, {
          kind: "activity",
          activity: frame.activity,
          previous,
        });
      }
      case "end":
        return this.closeRoom("ended", now);
    }
  }

  private receivePhoneText(
    connection: ConnectionId,
    entry: Extract<Connection, { role: "phone" }>,
    text: string,
    now: number,
  ): void {
    if (utf8ByteLength(text) > this.limits.frameBytes)
      return this.breakLimits(connection, entry, now);
    const parsed = parsePhoneToRoomFrame(text);
    if (parsed.status !== "frame")
      return this.ignore(connection, entry, parsed.status, "frame", now);
    const admission = entry.budget.admit("frame", now);
    if (admission === "flooded")
      return this.breakLimits(connection, entry, now);
    if (admission === "over-rate") {
      this.counters.overRate += 1;
      return;
    }
    this.handlePhoneFrame(connection, entry, parsed.frame, now);
  }

  private handlePhoneFrame(
    connection: ConnectionId,
    entry: Extract<Connection, { role: "phone" }>,
    frame: PhoneToRoomFrame,
    now: number,
  ): void {
    const seatId = entry.seat;
    const seat = this.seats.get(seatId);
    if (!seat) throw new Error(`Connection ${connection} has no seat.`);
    switch (frame.type) {
      case "request":
        this.counters.requests += 1;
        if (this.hostConnection === null)
          return this.send(connection, {
            type: "response",
            id: frame.id,
            refused: "host-away",
          });
        if (entry.requests) {
          const oldest = entry.requests.values().next();
          if (entry.requests.size >= MAXIMUM_WAITING_REQUESTS && !oldest.done)
            entry.requests.delete(oldest.value);
          entry.requests.add(frame.id);
        }
        return this.send(this.hostConnection, {
          type: "request",
          seat: seatId,
          id: frame.id,
          channel: frame.channel,
          name: frame.name,
          payload: frame.payload,
        });
      case "profile":
        if (frame.label !== undefined) seat.label = frame.label;
        if (frame.avatarId !== undefined) seat.avatarId = frame.avatarId;
        this.changedSeats.add(seatId);
        return this.announceSeat(seat, null);
      case "leave":
        this.connections.delete(connection);
        this.closeConnection(connection, "left");
        return this.freeSeat(seat, "left", now);
    }
  }

  private receiveInput(
    connection: ConnectionId,
    entry: Extract<Connection, { role: "phone" }>,
    frame: Uint8Array,
    now: number,
  ): void {
    if (frame[0] !== INPUT_FRAME_KIND)
      return this.ignore(connection, entry, "unknown", "input", now);
    if (frame.byteLength - 1 > this.limits.inputBytes)
      return this.breakLimits(connection, entry, now);
    const admission = entry.budget.admit("input", now);
    if (admission === "flooded")
      return this.breakLimits(connection, entry, now);
    if (admission === "over-rate") {
      this.counters.overRate += 1;
      this.heldInputs.set(connection, frame);
      return;
    }
    this.heldInputs.delete(connection);
    this.forwardInput(entry, frame);
  }

  private forwardInput(
    entry: Extract<Connection, { role: "phone" }>,
    frame: Uint8Array,
  ): void {
    if (this.hostConnection === null) return;
    this.counters.inputs += 1;
    this.send(this.hostConnection, encodeHostInputFrame(entry.seat, frame));
  }

  /**
   * A frame the room does not act on still spends its lane's flood
   * allowance; one that does not parse is also a strike, and one nested too
   * deep breaks the limits outright.
   */
  private ignore(
    connection: ConnectionId,
    entry: Connection,
    status: "unknown" | "invalid" | "too-deep",
    lane: FrameLane,
    now: number,
  ): void {
    if (status === "too-deep" || !entry.budget.spend(lane, now))
      return this.breakLimits(connection, entry, now);
    if (status === "invalid") this.strike(connection, entry, now);
  }

  private strike(
    connection: ConnectionId,
    entry: Connection,
    now: number,
  ): void {
    this.counters.strikes += 1;
    if (entry.budget.strike(now)) this.breakLimits(connection, entry, now);
  }

  /** Sizes are a property of the content, so a breach is final rather than counted. */
  private breakLimits(
    connection: ConnectionId,
    entry: Connection,
    now: number,
  ): void {
    this.connections.delete(connection);
    this.closeConnection(connection, "limits-broken");
    this.release(entry, now);
  }

  /** What follows a connection ending while its host or seat stays. */
  private release(entry: Connection, now: number): void {
    if (entry.role === "host") return this.hostLeft(now);
    const seat = this.seats.get(entry.seat);
    if (seat) this.seatLeft(seat, now);
  }

  private hostLeft(now: number): void {
    this.hostConnection = null;
    this.hostAwayUntil = now + this.limits.hostGraceMs;
    this.roomChanged = true;
    this.toPhones({ type: "host", present: false });
  }

  private seatLeft(seat: Seat, now: number): void {
    seat.connection = null;
    const hold = seat.kind === "agent" ? 0 : this.limits.seatHoldMs;
    if (hold === 0) return this.freeSeat(seat, "dropped", now);
    seat.holdUntil = now + hold;
    this.changedSeats.add(seat.id);
    this.announceSeat(seat, null);
    this.fact(now, { kind: "seat-dropped", seat: seat.id });
  }

  private freeSeat(seat: Seat, cause: SeatLeaveCause, at: number): void {
    this.seats.delete(seat.id);
    this.seatsByKey.delete(seat.key);
    this.changedSeats.add(seat.id);
    const left = { type: "left", seat: seat.id } as const;
    this.toHost(left);
    this.toPhones(left);
    this.fact(at, { kind: "seat-left", seat: seat.id, cause });
  }

  private closeRoom(cause: RoomCloseCause, at: number): void {
    const reason = cause === "restarting" ? "restarting" : "closed";
    for (const connection of this.connections.keys())
      this.closeConnection(connection, reason);
    this.connections.clear();
    this.hostConnection = null;
    this.closed = true;
    this.fact(at, { kind: "closed", cause });
  }

  private announceSeat(
    seat: Seat,
    except: SeatId | null,
    inputBaseline = false,
  ): void {
    const frame = { type: "seat", seat: this.seatView(seat) } as const;
    this.toHost(inputBaseline ? { ...frame, inputBaseline: true } : frame);
    for (const other of this.seats.values())
      if (other.id !== except && other.connection !== null)
        this.send(other.connection, frame);
  }

  private seatView(seat: Seat): SeatView {
    return {
      id: seat.id,
      label: seat.localSeatLabel ?? seat.label,
      color: seat.color,
      avatarId: seat.avatarId,
      kind: seat.kind,
      connected: seat.connection !== null,
    };
  }

  private seatViews(): SeatView[] {
    return [...this.seats.values()].map((seat) => this.seatView(seat));
  }

  private toHost(frame: RoomToHostFrame): void {
    if (this.hostConnection !== null) this.send(this.hostConnection, frame);
  }

  private toPhones(frame: RoomToPhoneFrame): void {
    const data = encodeFrame(frame);
    for (const seat of this.seats.values())
      if (seat.connection !== null) this.send(seat.connection, data);
  }

  private send(
    connection: ConnectionId,
    frame: RoomToHostFrame | RoomToPhoneFrame | string | Uint8Array,
  ): void {
    const data =
      typeof frame === "string" || frame instanceof Uint8Array
        ? frame
        : encodeFrame(frame);
    this.effects.push({ send: connection, data });
  }

  private closeConnection(
    connection: ConnectionId,
    reason: RoomCloseReason,
  ): void {
    this.effects.push({ close: connection, reason });
  }

  private fact(at: number, event: RoomEvent): void {
    this.effects.push({
      fact: {
        at,
        code: this.code,
        instance: this.instance,
        labels: this.labels,
        ...event,
      },
    });
  }

  private record(): SavedRoomRecord {
    return {
      code: this.code,
      instance: this.instance,
      hostKey: this.hostKey,
      limits: this.limits,
      labels: this.labels,
      activity: this.activity,
      activityChangeable: this.activityChangeable,
      openedAt: this.openedAt,
      seatsWanted: this.seatsWanted,
      locked: this.locked,
      nextSeatNumber: this.nextSeatNumber,
      hostConnection: this.hostConnection,
      hostAwayUntil: this.hostAwayUntil,
    };
  }

  private savedSeat(seat: Seat): SavedSeat {
    return { ...seat };
  }
}
