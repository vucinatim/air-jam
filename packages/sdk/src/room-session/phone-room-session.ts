import type { AirJamInput, AirJamInputState } from "../core/input";
import {
  DEFAULT_ROOM_LIMITS,
  encodeFrame,
  parseRoomToPhoneFrame,
  type PhoneHello,
  type RoomLimits,
  type RoomToPhoneFrame,
  type RoomWireData,
  type SeatId,
  type SeatKind,
  type SeatProfile,
  type SeatView,
  type StateDocument,
} from "../room-protocol";
import { ChannelMirror } from "./channel-state";
import { spacingForRate } from "./clock";
import { PhoneInputLane } from "./input-lane";
import { Listeners } from "./listeners";
import { Roster } from "./roster";
import {
  SESSION_SDK,
  SessionLink,
  type RoomSessionOptions,
  type RoomSessionStatus,
} from "./session-link";

export interface PhoneSessionOptions extends RoomSessionOptions {
  readonly code: string;
  readonly kind?: SeatKind;
  readonly profile?: SeatProfile;
  /** The game's declared controls; a phone without them sends no input. */
  readonly input?: AirJamInput;
}

export type RoomRequestOutcome =
  | { readonly status: "answered"; readonly result: unknown }
  /** The room answered itself because no host could. */
  | { readonly status: "refused"; readonly reason: "host-away" }
  /** No answer: the link dropped after sending, or the time ran out. The host may have acted on it. */
  | { readonly status: "unconfirmed" }
  /** An exclusive request of the same channel and name is still waiting. */
  | { readonly status: "busy" };

export interface RoomRequestOptions {
  /** How long to wait for the answer, counted from the call. */
  readonly timeoutMs?: number;
  /** At most one request of this channel and name waits at a time, as leased control needs. */
  readonly exclusive?: boolean;
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

export interface PhoneSessionEvents extends Record<string, unknown> {
  status: RoomSessionStatus;
  seats: readonly SeatView[];
  /** Whether the screen is in the room. */
  host: boolean;
  state: { readonly channel: string; readonly document: StateDocument };
  drop: { readonly channel: string };
  signal: { readonly kind: string; readonly payload: unknown };
}

interface PendingRequest {
  readonly frame: string;
  readonly exclusiveKey: string | null;
  readonly resolve: (outcome: RoomRequestOutcome) => void;
  readonly cancelTimeout: () => void;
  sent: boolean;
}

/** A player's device in a room: its seat, the room's state, its input and its requests. */
export class PhoneRoomSession {
  private readonly events = new Listeners<PhoneSessionEvents>();
  private readonly link: SessionLink;
  private readonly roster = new Roster();
  private readonly mirror = new ChannelMirror();
  private readonly lane: PhoneInputLane | null;
  private readonly requests = new Map<number, PendingRequest>();
  private readonly exclusive = new Set<string>();
  private nextRequestId = 1;
  private cancelInput: (() => void) | null = null;
  private relayedInput: Uint8Array | null = null;
  private cancelRelayedInput: (() => void) | null = null;
  private currentFeatures: readonly string[] = [];
  private profile: SeatProfile | undefined;
  private currentInstance: string | undefined;
  private currentSeat: SeatId | null = null;
  private hostPresent = false;
  private currentLimits: RoomLimits = DEFAULT_ROOM_LIMITS;

  constructor(private readonly options: PhoneSessionOptions) {
    this.profile = options.profile;
    this.currentInstance = options.instance;
    this.lane = options.input ? new PhoneInputLane(options.input) : null;
    this.link = new SessionLink(options, {
      address: () => ({ role: "phone", code: options.code }),
      hello: () => this.hello(),
      receive: (data) => this.receive(data),
      lost: () => this.lost(),
      status: (status) => {
        if (status.phase === "closed")
          for (const id of [...this.requests.keys()])
            this.settle(id, { status: "unconfirmed" });
        this.events.emit("status", status);
      },
    });
    this.link.start();
  }

  readonly on = this.events.on.bind(this.events);

  get status(): RoomSessionStatus {
    return this.link.status;
  }
  get code(): string {
    return this.options.code;
  }
  /** The room instance this seat belongs to; store it with the key to resume after a reload. */
  get instance(): string | undefined {
    return this.currentInstance;
  }
  get seat(): SeatId | null {
    return this.currentSeat;
  }
  get seats(): readonly SeatView[] {
    return this.roster.list();
  }
  get host(): boolean {
    return this.hostPresent;
  }
  get limits(): RoomLimits {
    return this.currentLimits;
  }
  get features(): readonly string[] {
    return this.currentFeatures;
  }
  channel(channel: string): StateDocument | undefined {
    return this.mirror.document(channel);
  }
  /** Every channel this seat mirrors. */
  documents(): ReadonlyMap<string, StateDocument> {
    return this.mirror.documents();
  }

  /** The controls' whole state; the session decides when it travels. */
  sendInput(state: AirJamInputState): void {
    if (!this.lane)
      throw new Error("This phone session was created without input controls.");
    this.lane.update(state);
    this.pumpInput();
  }

  /**
   * A whole phone input frame from a frame this page serves, whose own
   * session paced it. Behind a stalled link only the latest waits.
   */
  sendInputFrame(frame: Uint8Array): void {
    this.relayedInput = frame;
    this.pumpRelayedInput();
  }

  request(
    channel: string,
    name: string,
    payload?: unknown,
    options: RoomRequestOptions = {},
  ): Promise<RoomRequestOutcome> {
    if (this.link.status.phase === "closed")
      return Promise.resolve({ status: "unconfirmed" });
    const exclusiveKey = options.exclusive ? `${channel}\u0000${name}` : null;
    if (exclusiveKey !== null && this.exclusive.has(exclusiveKey))
      return Promise.resolve({ status: "busy" });
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise((resolve) => {
      const clock = this.link.clock;
      const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
      const pending: PendingRequest = {
        frame: encodeFrame({ type: "request", id, channel, name, payload }),
        exclusiveKey,
        resolve,
        cancelTimeout: clock.at(clock.now() + timeoutMs, () =>
          this.settle(id, { status: "unconfirmed" }),
        ),
        sent: false,
      };
      this.requests.set(id, pending);
      if (exclusiveKey !== null) this.exclusive.add(exclusiveKey);
      pending.sent = this.link.send(pending.frame);
    });
  }

  setProfile(profile: Pick<SeatProfile, "label" | "avatarId">): void {
    this.profile = { ...this.profile, ...profile };
    this.link.send(encodeFrame({ type: "profile", ...profile }));
  }

  /** Gives the seat up for good. */
  leave(): void {
    if (!this.link.send(encodeFrame({ type: "leave" }))) this.close();
  }

  close(): void {
    this.link.close();
  }

  private hello(): string {
    const hello: PhoneHello = {
      type: "hello",
      key: this.options.key,
      sdk: SESSION_SDK,
      kind: this.options.kind ?? "phone",
      ...(this.currentInstance === undefined
        ? {}
        : { instance: this.currentInstance }),
      ...(this.profile === undefined ? {} : { profile: this.profile }),
    };
    return encodeFrame(hello);
  }

  private receive(data: RoomWireData): void {
    if (typeof data !== "string") return;
    const parsed = parseRoomToPhoneFrame(data);
    if (parsed.status === "unknown") return;
    if (parsed.status !== "frame") return this.link.fail();
    this.handle(parsed.frame);
  }

  private handle(frame: RoomToPhoneFrame): void {
    switch (frame.type) {
      case "welcome":
        this.currentInstance = frame.instance;
        this.currentSeat = frame.seat;
        this.currentLimits = frame.limits;
        this.currentFeatures = frame.features;
        this.hostPresent = frame.host;
        this.roster.reset(frame.seats);
        this.mirror.reset(frame.channels);
        this.link.markOpen();
        this.events.emit("seats", this.roster.list());
        this.events.emit("host", this.hostPresent);
        for (const [channel, document] of this.mirror.documents())
          this.events.emit("state", { channel, document });
        for (const pending of this.requests.values())
          if (!pending.sent) pending.sent = this.link.send(pending.frame);
        return this.resendInput();
      case "seat":
        this.roster.upsert(frame.seat);
        return this.events.emit("seats", this.roster.list());
      case "left":
        this.roster.remove(frame.seat);
        return this.events.emit("seats", this.roster.list());
      case "host":
        this.hostPresent = frame.present;
        this.events.emit("host", frame.present);
        if (frame.present) this.resendInput();
        return;
      case "state": {
        const document = this.mirror.receive(frame);
        if (document)
          this.events.emit("state", { channel: frame.channel, document });
        return;
      }
      case "drop":
        if (this.mirror.drop(frame.channel))
          this.events.emit("drop", { channel: frame.channel });
        return;
      case "response":
        return this.settle(
          frame.id,
          "refused" in frame
            ? { status: "refused", reason: frame.refused }
            : { status: "answered", result: frame.result },
        );
      case "signal":
        return this.events.emit("signal", {
          kind: frame.kind,
          payload: frame.payload,
        });
    }
  }

  private lost(): void {
    this.cancelInput?.();
    this.cancelInput = null;
    this.cancelRelayedInput?.();
    this.cancelRelayedInput = null;
    this.relayedInput = null;
    for (const [id, pending] of this.requests)
      if (pending.sent) this.settle(id, { status: "unconfirmed" });
  }

  private settle(id: number, outcome: RoomRequestOutcome): void {
    const pending = this.requests.get(id);
    if (!pending) return;
    this.requests.delete(id);
    pending.cancelTimeout();
    if (pending.exclusiveKey !== null)
      this.exclusive.delete(pending.exclusiveKey);
    pending.resolve(outcome);
  }

  /** A phone re-sends its controls once after joining and when the host returns. */
  private resendInput(): void {
    const frame = this.lane?.take(this.link.clock.now());
    if (frame) this.link.send(frame);
    this.pumpInput();
  }

  private pumpRelayedInput(): void {
    if (!this.relayedInput || !this.link.open || this.cancelRelayedInput)
      return;
    const clock = this.link.clock;
    if (this.link.buffered) {
      this.cancelRelayedInput = clock.at(
        clock.now() + this.currentLimits.inputIntervalMs,
        () => {
          this.cancelRelayedInput = null;
          this.pumpRelayedInput();
        },
      );
      return;
    }
    this.link.send(this.relayedInput);
    this.relayedInput = null;
  }

  private pumpInput(): void {
    const lane = this.lane;
    if (!lane || !this.link.open) return;
    this.cancelInput?.();
    this.cancelInput = null;
    const due = lane.due(
      this.currentLimits.inputIntervalMs,
      spacingForRate(this.currentLimits.inputsPerSecond),
    );
    if (due === null) return;
    const clock = this.link.clock;
    // Behind a stalled network, input waits until the link drains and then
    // sends only the latest controls, rather than queueing stale ones.
    const ready = this.link.buffered
      ? clock.now() + this.currentLimits.inputIntervalMs
      : due;
    if (ready <= clock.now()) {
      const frame = lane.take(clock.now());
      if (frame) this.link.send(frame);
      return;
    }
    this.cancelInput = clock.at(ready, () => {
      this.cancelInput = null;
      this.pumpInput();
    });
  }
}
