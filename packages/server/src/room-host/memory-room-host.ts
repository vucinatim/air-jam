import {
  encodeFrame,
  joinHostInputFrames,
  parseHostHello,
  PING_FRAME,
  PONG_FRAME,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  roomCloseCodes,
  type HostHello,
  type RoomAcceptor,
  type RoomAddress,
  type RoomCloseReason,
  type RoomConnection,
  type RoomConnectionHandlers,
  type RoomWireData,
} from "@air-jam/sdk/room-protocol";
import { systemRoomClock, type RoomClock } from "@air-jam/sdk/room-session";
import type { RoomFact } from "../room/facts.js";
import type { RoomGate } from "../room/gate.js";
import { Room, type RoomDescription, type RoomEffect } from "../room/room.js";
import type { ConnectionId } from "../room/saved-room.js";

export interface MemoryRoomHostOptions {
  readonly gate: RoomGate;
  /** Whether a host may ask for its room's code, as a local server allows; hosted rooms choose. */
  readonly codesMayBeAsked: boolean;
  readonly clock?: RoomClock;
  /**
   * Runs `flush` once the work of the current turn is done. Input bound for
   * one host that became ready in the same turn leaves as one message; the
   * default packs what one synchronous run produced.
   */
  readonly afterTurn?: (flush: () => void) => void;
  readonly onFact?: (fact: RoomFact) => void;
  /** A gate that failed; the host was told to try later. */
  readonly onGateError?: (error: unknown) => void;
  /** How long a queued host waits before the gate is asked again. */
  readonly gateRetryMs?: number;
}

/** Frames a device may send before its room exists, while the gate decides. */
const ADMISSION_BUFFER_FRAMES = 16;

type Stage = "hello" | "admitting" | "bound" | "closed";

interface Accepted {
  readonly id: ConnectionId;
  readonly address: RoomAddress;
  readonly origin: string | null;
  readonly transport: RoomConnection;
  stage: Stage;
  room: HostedRoom | null;
  readonly buffered: RoomWireData[];
  cancelGateRetry: (() => void) | null;
}

interface HostedRoom {
  readonly code: string;
  readonly room: Room;
  wakeAt: number | null;
  cancelWake: (() => void) | null;
}

const randomCode = (): string =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH)),
    (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length],
  ).join("");

/**
 * Rooms held in memory, for the Node server and for in-process loopback
 * links. It owns only wiring: it routes a connection by its path, runs the
 * gate before a room exists, calls the room with the role from the path,
 * applies the effects the room returns, keeps one timer per room for its
 * next deadline and packs host-bound input that is ready together. Every
 * room rule is the room's own.
 */
export class MemoryRoomHost implements RoomAcceptor {
  private readonly rooms = new Map<string, HostedRoom>();
  private readonly connections = new Map<ConnectionId, Accepted>();
  private readonly pendingInput = new Map<ConnectionId, Uint8Array[]>();
  private flushScheduled = false;
  private nextConnection = 1;
  private stopped = false;
  private readonly clock: RoomClock;
  private readonly afterTurn: (flush: () => void) => void;

  constructor(private readonly options: MemoryRoomHostOptions) {
    this.clock = options.clock ?? systemRoomClock;
    this.afterTurn = options.afterTurn ?? queueMicrotask;
  }

  accept(
    address: RoomAddress,
    origin: string | null,
    transport: RoomConnection,
  ): RoomConnectionHandlers {
    const accepted: Accepted = {
      id: `c${this.nextConnection}`,
      address,
      origin,
      transport,
      stage: "hello",
      room: null,
      buffered: [],
      cancelGateRetry: null,
    };
    this.nextConnection += 1;
    this.connections.set(accepted.id, accepted);
    if (this.stopped) this.closeConnection(accepted, "restarting");
    return {
      receive: (data) => this.receive(accepted, data),
      closed: () => this.closed(accepted),
    };
  }

  /** Stops every room as the server goes down; its devices are told to come back. */
  stop(): void {
    this.stopped = true;
    for (const hosted of [...this.rooms.values()])
      this.call(hosted, (room, now) => room.stop("restarting", now));
    for (const accepted of [...this.connections.values()])
      if (accepted.stage !== "bound")
        this.closeConnection(accepted, "restarting");
  }

  describe(): RoomDescription[] {
    return [...this.rooms.values()].map((hosted) => hosted.room.describe());
  }

  private receive(accepted: Accepted, data: RoomWireData): void {
    if (data === PING_FRAME) return accepted.transport.send(PONG_FRAME);
    switch (accepted.stage) {
      case "closed":
        return;
      case "bound": {
        const hosted = accepted.room;
        if (!hosted) throw new Error(`Connection ${accepted.id} has no room.`);
        return this.call(hosted, (room, now) =>
          room.receive(accepted.id, data, now),
        );
      }
      case "admitting":
        if (accepted.buffered.length >= ADMISSION_BUFFER_FRAMES)
          return this.closeConnection(accepted, "limits-broken");
        accepted.buffered.push(data);
        return;
      case "hello":
        if (typeof data !== "string")
          return this.closeConnection(accepted, "unsupported-version");
        return this.hello(accepted, data);
    }
  }

  private hello(accepted: Accepted, hello: string): void {
    const { address } = accepted;
    const existing =
      address.code === null ? undefined : this.rooms.get(address.code);
    if (existing) return this.bind(accepted, existing, hello);
    if (address.role === "phone")
      return this.closeConnection(accepted, "not-found");
    const frame = parseHostHello(hello);
    if (!frame) return this.closeConnection(accepted, "unsupported-version");
    // A resume names an instance that is gone; only a fresh hello opens a room.
    if (
      frame.instance !== undefined ||
      (address.code !== null && !this.options.codesMayBeAsked)
    )
      return this.closeConnection(accepted, "not-found");
    accepted.stage = "admitting";
    void this.admit(accepted, frame, hello);
  }

  private async admit(
    accepted: Accepted,
    frame: HostHello,
    hello: string,
  ): Promise<void> {
    let decision;
    try {
      decision = await this.options.gate.admit({
        hello: frame,
        origin: accepted.origin,
      });
    } catch (error) {
      this.options.onGateError?.(error);
      return this.closeConnection(accepted, "try-later");
    }
    if (accepted.stage !== "admitting") return;
    if (this.stopped) return this.closeConnection(accepted, "restarting");
    if (decision.outcome === "refuse")
      return this.closeConnection(accepted, decision.reason);
    if (decision.outcome === "wait") {
      accepted.transport.send(
        encodeFrame({ type: "wait", position: decision.position }),
      );
      accepted.cancelGateRetry = this.clock.at(
        this.clock.now() + (this.options.gateRetryMs ?? 2_000),
        () => {
          accepted.cancelGateRetry = null;
          void this.admit(accepted, frame, hello);
        },
      );
      return;
    }
    const code = accepted.address.code ?? this.freeCode();
    // A host that asked for a code may find another host opened it meanwhile.
    const existing = this.rooms.get(code);
    if (existing) return this.bind(accepted, existing, hello);
    const opened = Room.open(
      {
        code,
        instance: crypto.randomUUID(),
        hostKey: frame.key,
        limits: decision.limits,
        labels: decision.labels,
        activity: decision.activity,
        activityChangeable: decision.activityChangeable,
      },
      this.clock.now(),
    );
    const hosted: HostedRoom = {
      code,
      room: opened.room,
      wakeAt: null,
      cancelWake: null,
    };
    this.rooms.set(code, hosted);
    this.apply(hosted, opened.effects);
    this.bind(accepted, hosted, hello);
  }

  private bind(accepted: Accepted, hosted: HostedRoom, hello: string): void {
    accepted.stage = "bound";
    accepted.room = hosted;
    this.call(hosted, (room, now) =>
      room.connect(accepted.id, accepted.address.role, hello, now),
    );
    for (const data of accepted.buffered.splice(0))
      this.receive(accepted, data);
  }

  private closed(accepted: Accepted): void {
    const stage = accepted.stage;
    if (stage === "closed") return;
    this.forget(accepted);
    const hosted = accepted.room;
    if (stage === "bound" && hosted)
      this.call(hosted, (room, now) => room.disconnect(accepted.id, now));
  }

  private call(
    hosted: HostedRoom,
    work: (room: Room, now: number) => RoomEffect[],
  ): void {
    this.apply(hosted, work(hosted.room, this.clock.now()));
    this.scheduleWake(hosted);
  }

  private apply(hosted: HostedRoom, effects: readonly RoomEffect[]): void {
    for (const effect of effects) {
      if ("fact" in effect) {
        this.options.onFact?.(effect.fact);
        if (effect.fact.kind === "closed") this.retire(hosted);
        continue;
      }
      const target =
        "send" in effect
          ? this.connections.get(effect.send)
          : this.connections.get(effect.close);
      if (!target) continue;
      if ("close" in effect) this.closeConnection(target, effect.reason);
      else if (effect.data instanceof Uint8Array)
        this.queueInput(target, effect.data);
      else {
        this.flushInput(target);
        target.transport.send(effect.data);
      }
    }
  }

  private scheduleWake(hosted: HostedRoom): void {
    const next =
      this.rooms.get(hosted.code) === hosted ? hosted.room.nextWake() : null;
    if (next === hosted.wakeAt) return;
    hosted.cancelWake?.();
    hosted.cancelWake = null;
    hosted.wakeAt = next;
    if (next === null) return;
    hosted.cancelWake = this.clock.at(next, () => {
      hosted.cancelWake = null;
      hosted.wakeAt = null;
      this.call(hosted, (room, now) => room.wake(now));
    });
  }

  private retire(hosted: HostedRoom): void {
    if (this.rooms.get(hosted.code) === hosted) this.rooms.delete(hosted.code);
    hosted.cancelWake?.();
    hosted.cancelWake = null;
  }

  private queueInput(target: Accepted, frame: Uint8Array): void {
    const queued = this.pendingInput.get(target.id);
    if (queued) queued.push(frame);
    else this.pendingInput.set(target.id, [frame]);
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    this.afterTurn(() => {
      this.flushScheduled = false;
      for (const id of [...this.pendingInput.keys()]) {
        const connection = this.connections.get(id);
        if (connection) this.flushInput(connection);
      }
    });
  }

  /** Sends what is queued for a host before anything that follows it, keeping order. */
  private flushInput(target: Accepted): void {
    const frames = this.pendingInput.get(target.id);
    if (!frames) return;
    this.pendingInput.delete(target.id);
    target.transport.send(
      frames.length === 1 && frames[0]
        ? frames[0]
        : joinHostInputFrames(frames),
    );
  }

  private closeConnection(accepted: Accepted, reason: RoomCloseReason): void {
    if (accepted.stage === "closed") return;
    this.forget(accepted);
    accepted.transport.close(roomCloseCodes[reason].code);
  }

  private forget(accepted: Accepted): void {
    accepted.stage = "closed";
    accepted.cancelGateRetry?.();
    accepted.cancelGateRetry = null;
    this.connections.delete(accepted.id);
    this.pendingInput.delete(accepted.id);
  }

  private freeCode(): string {
    for (;;) {
      const code = randomCode();
      if (!this.rooms.has(code)) return code;
    }
  }
}
