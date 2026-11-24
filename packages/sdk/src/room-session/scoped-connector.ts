import {
  ABNORMAL_CLOSE_CODE,
  decodeHostInputFrame,
  encodeFrame,
  encodeHostInputFrame,
  encodePhoneInputFrame,
  INPUT_FRAME_KIND,
  joinHostInputFrames,
  parseHostHello,
  parseHostToRoomFrame,
  parsePhoneHello,
  parsePhoneToRoomFrame,
  PING_FRAME,
  PONG_FRAME,
  roomCloseCodes,
  type ChannelCopy,
  type RoomCloseReason,
  type RoomConnector,
  type RoomLinkHandlers,
  type RoomToHostFrame,
  type RoomToPhoneFrame,
  type RoomWireData,
  type SeatId,
  type SeatView,
} from "../room-protocol";
import { ChannelMirror } from "./channel-state";
import type { HostRoom } from "./host-room-session";
import type { PhoneRoomSession } from "./phone-room-session";
import type { RoomSessionStatus } from "./session-link";

/**
 * Serves a frame a room that is a view of the page's own session, scoped to
 * the channels the frame may use. The frame runs an ordinary session over
 * it, usually through `createPortConnector` and `serveRoomPort`, so its code
 * is the same standalone and embedded. The page's session stays the one
 * connection to the room and its one writer: the room's rules apply there,
 * once, and nothing a frame sends reaches the page's session except through
 * its public calls.
 */
export interface ScopedConnector {
  readonly connector: RoomConnector;
  /**
   * Closes the frame's links for good and stops following the page's
   * session, as when the surface they belong to ends.
   */
  close(): void;
}

/** Which channels a frame may see and write; every other channel stays the page's. */
export type ChannelScope = (channel: string) => boolean;

/** Answers given back to a frame are bounded like the room's own memory of unanswered requests. */
const MAXIMUM_FORWARDED_REQUESTS = 1_024;

const closeCode = (reason: RoomCloseReason): number =>
  roomCloseCodes[reason].code;

/** The page's side of one frame link: ordered, asynchronous delivery, as on a network. */
class FrameLink {
  private clientClosed = false;
  private serverClosed = false;
  welcomed = false;

  constructor(private readonly handlers: RoomLinkHandlers) {
    queueMicrotask(() => {
      if (!this.clientClosed) handlers.open();
    });
  }

  get live(): boolean {
    return !this.clientClosed && !this.serverClosed;
  }

  send(data: RoomWireData): void {
    if (!this.live) return;
    const delivered = typeof data === "string" ? data : data.slice();
    queueMicrotask(() => {
      if (!this.clientClosed) this.handlers.message(delivered);
    });
  }

  close(code: number): void {
    if (!this.live) return;
    this.serverClosed = true;
    queueMicrotask(() => {
      if (!this.clientClosed) this.handlers.close(code);
    });
  }

  clientClose(): void {
    this.clientClosed = true;
  }
}

/** One frame's links and how they follow the page's session. */
class FrameLinks {
  private readonly links = new Set<FrameLink>();
  private stopped = false;

  constructor(private readonly welcome: (link: FrameLink) => void) {}

  add(link: FrameLink): void {
    this.links.add(link);
  }

  remove(link: FrameLink): void {
    this.links.delete(link);
  }

  welcomed(): FrameLink[] {
    return [...this.links].filter((link) => link.live && link.welcomed);
  }

  /**
   * A frame has one link at a time, as a host has one connection: welcoming
   * a link closes every other as `replaced`, which tells the frame it held
   * not to come back. A reloaded or slow-closing old frame then cannot
   * publish over the new one or send input for the same seat.
   */
  replaceOthers(link: FrameLink): void {
    for (const other of [...this.links]) {
      if (other === link) continue;
      other.close(closeCode("replaced"));
      this.links.delete(other);
    }
  }

  /**
   * The page's session changed status. While it is away, welcomed links are
   * lost and reconnect, and hellos wait; when it is back, waiting hellos are
   * answered; when it closed for good, so does every link.
   */
  follow(status: RoomSessionStatus, waiting: (link: FrameLink) => boolean) {
    if (status.phase === "closed")
      return this.closeAll(
        closeCode(status.reason === "owner" ? "closed" : status.reason),
      );
    for (const link of [...this.links]) {
      if (!link.live) {
        this.links.delete(link);
        continue;
      }
      if (status.phase !== "open") {
        if (link.welcomed) {
          link.close(ABNORMAL_CLOSE_CODE);
          this.links.delete(link);
        }
      } else if (!link.welcomed && waiting(link)) this.welcome(link);
    }
  }

  closeAll(code: number): void {
    this.stopped = true;
    for (const link of this.links) link.close(code);
    this.links.clear();
  }

  get closed(): boolean {
    return this.stopped;
  }
}

type RosterFrame =
  | { readonly type: "seat"; readonly seat: SeatView }
  | { readonly type: "left"; readonly seat: SeatId };

/** Seat frames that bring a frame's roster from what it was last told to `seats`. */
const rosterChanges = (
  told: Map<SeatId, SeatView>,
  seats: readonly SeatView[],
): RosterFrame[] => {
  const frames: RosterFrame[] = [];
  const current = new Set<SeatId>();
  for (const seat of seats) {
    current.add(seat.id);
    if (JSON.stringify(told.get(seat.id)) === JSON.stringify(seat)) continue;
    told.set(seat.id, seat);
    frames.push({ type: "seat", seat });
  }
  for (const id of [...told.keys()])
    if (!current.has(id)) {
      told.delete(id);
      frames.push({ type: "left", seat: id });
    }
  return frames;
};

const rosterOf = (seats: readonly SeatView[]) =>
  new Map(seats.map((seat) => [seat.id, seat]));

/**
 * A host frame's room, served by the page's host session: an embedded game
 * in a launcher. The frame publishes, answers requests on its channels,
 * signals, configures seats and removes players; it may not change the
 * activity or end the room. A frame that tries closes `unauthorised`.
 *
 * Revisions on the frame's link are the link's own: its documents and
 * patches apply to a copy here, and the page's session publishes the result
 * to the room with its own revisions, pacing and answers to `need`.
 */
export const createScopedHostConnector = (
  parent: HostRoom,
  scope: ChannelScope,
): ScopedConnector & {
  /** Closes the frame's links and drops every channel in its scope, as when its game ends. */
  end(): void;
} => {
  const hellos = new WeakMap<FrameLink, number>();
  const mirrors = new WeakMap<FrameLink, ChannelMirror>();
  const toldSeats = new WeakMap<FrameLink, Map<SeatId, SeatView>>();
  /**
   * The latest input record of each seat, so a frame attached after the
   * phones last sent theirs starts with every seat's controls. Cleared when
   * the seat leaves, so it holds at most one record per seat in the room.
   */
  const latestInput = new Map<SeatId, Uint8Array>();
  /** Requests sent to the frame and not yet answered; only those answers reach the room. */
  const forwarded = new Set<string>();

  const welcome = (link: FrameLink) => {
    const seats = hellos.get(link);
    const room = parent.room;
    const instance = parent.instance;
    const code = parent.code;
    if (seats === undefined || !room || !instance || !code) return;
    if (seats !== room.seatsWanted) parent.configure({ seats });
    const channels: ChannelCopy[] = parent
      .channels()
      .filter((copy) => scope(copy.channel))
      .map((copy) => ({ ...copy, revision: 0 }));
    const mirror = new ChannelMirror();
    mirror.reset(channels);
    mirrors.set(link, mirror);
    toldSeats.set(link, rosterOf(parent.seats));
    links.replaceOthers(link);
    link.welcomed = true;
    link.send(
      encodeFrame({
        type: "welcome",
        code,
        instance,
        seats: [...parent.seats],
        channels,
        limits: parent.limits,
        features: [...room.features],
        seatsWanted: seats,
        locked: room.locked,
        activity: room.activity,
      }),
    );
    if (latestInput.size > 0)
      link.send(
        joinHostInputFrames(
          [...latestInput].map(([seat, payload]) =>
            encodeHostInputFrame(seat, encodePhoneInputFrame(payload)),
          ),
        ),
      );
  };
  const links = new FrameLinks(welcome);
  const forward = (frame: RoomToHostFrame) => {
    const data = encodeFrame(frame);
    for (const link of links.welcomed()) link.send(data);
  };

  const releases = [
    parent.on("status", (status) =>
      links.follow(status, (link) => hellos.has(link)),
    ),
    parent.on("seats", (seats) => {
      const present = new Set(seats.map((seat) => seat.id));
      for (const seat of [...latestInput.keys()])
        if (!present.has(seat)) latestInput.delete(seat);
      for (const entry of [...forwarded])
        if (!present.has(entry.slice(0, entry.indexOf(":"))))
          forwarded.delete(entry);
      for (const link of links.welcomed()) {
        const told = toldSeats.get(link);
        if (!told) continue;
        for (const frame of rosterChanges(told, seats))
          link.send(encodeFrame(frame));
      }
    }),
    // A seat's new page restarts its controls: the frame decodes them afresh too.
    parent.on("inputBaseline", (seat) => {
      latestInput.delete(seat);
      const view = parent.seats.find((candidate) => candidate.id === seat);
      if (view) forward({ type: "seat", seat: view, inputBaseline: true });
    }),
    parent.on("inputFrame", (frame) => {
      let records;
      try {
        records = decodeHostInputFrame(frame);
      } catch {
        return;
      }
      for (const record of records)
        latestInput.set(record.seat, record.payload.slice());
      for (const link of links.welcomed()) link.send(frame);
    }),
    parent.on("request", (request) => {
      if (!scope(request.channel) || links.welcomed().length === 0) return;
      forwarded.add(`${request.seat}:${request.id}`);
      if (forwarded.size > MAXIMUM_FORWARDED_REQUESTS)
        forwarded.delete(forwarded.values().next().value as string);
      forward({ type: "request", ...request });
    }),
  ];
  const close = () => {
    links.closeAll(closeCode("closed"));
    for (const release of releases.splice(0)) release();
  };

  const receive = (link: FrameLink, data: RoomWireData): void => {
    if (!link.live) return;
    if (!hellos.has(link)) {
      const hello = typeof data === "string" ? parseHostHello(data) : null;
      if (!hello) return link.close(closeCode("unsupported-version"));
      hellos.set(link, hello.seats);
      if (parent.status.phase === "open") welcome(link);
      return;
    }
    if (data === PING_FRAME) return link.send(PONG_FRAME);
    if (!link.welcomed) return;
    if (typeof data !== "string") return link.close(closeCode("unauthorised"));
    const parsed = parseHostToRoomFrame(data);
    if (parsed.status === "unknown") return;
    if (parsed.status !== "frame")
      return link.close(closeCode("limits-broken"));
    const frame = parsed.frame;
    switch (frame.type) {
      case "state": {
        if (!scope(frame.channel)) return link.close(closeCode("unauthorised"));
        const mirror = mirrors.get(link);
        const document = mirror?.receive(frame) ?? null;
        const copy = mirror?.copy(frame.channel);
        if (document === null || !copy)
          return link.close(closeCode("limits-broken"));
        try {
          parent.publish(frame.channel, document, {
            ...(copy.fingerprint === undefined
              ? {}
              : { fingerprint: copy.fingerprint }),
            ...(copy.private === undefined ? {} : { private: copy.private }),
          });
        } catch {
          link.close(closeCode("limits-broken"));
        }
        return;
      }
      case "response":
        if (forwarded.delete(`${frame.seat}:${frame.id}`))
          parent.respond(frame.seat, frame.id, frame.result);
        return;
      case "signal":
        return parent.signal(frame.kind, frame.payload, frame.seat);
      case "room":
        return parent.configure({
          ...(frame.seats === undefined ? {} : { seats: frame.seats }),
          ...(frame.locked === undefined ? {} : { locked: frame.locked }),
        });
      case "remove":
        return parent.remove(frame.seat);
      case "drop":
        if (!scope(frame.channel)) return link.close(closeCode("unauthorised"));
        mirrors.get(link)?.drop(frame.channel);
        return parent.drop(frame.channel);
      case "activity":
      case "end":
        return link.close(closeCode("unauthorised"));
    }
  };

  const connector: RoomConnector = (address, handlers) => {
    const link = new FrameLink(handlers);
    if (address.role !== "host" || links.closed) {
      link.close(closeCode(links.closed ? "closed" : "unauthorised"));
      return { send: () => {}, buffered: () => false, close: () => {} };
    }
    links.add(link);
    if (parent.status.phase === "closed")
      links.follow(parent.status, () => false);
    return {
      send: (data) => receive(link, data),
      buffered: () => false,
      close: () => {
        link.clientClose();
        links.remove(link);
      },
    };
  };

  return {
    connector,
    close,
    end: () => {
      close();
      for (const copy of parent.channels())
        if (scope(copy.channel)) parent.drop(copy.channel);
    },
  };
};

/**
 * A phone frame's room, served by the page's phone session: an embedded
 * game's controller inside a launcher's controller page. The frame mirrors
 * its channels, sends input, makes requests on its channels and changes its
 * profile, all as the page's seat. Requests travel as the page's own, so
 * their ids never meet the page's; state reaches the frame as whole
 * documents with revisions of the frame's link.
 */
export const createScopedPhoneConnector = (
  parent: PhoneRoomSession,
  scope: ChannelScope,
  options: {
    /** Hears each profile change the frame makes for the page's seat, as a page that keeps its player's name does. */
    readonly onProfile?: (profile: {
      label?: string;
      avatarId?: string;
    }) => void;
  } = {},
): ScopedConnector => {
  const hellos = new WeakSet<FrameLink>();
  const revisions = new WeakMap<FrameLink, Map<string, number>>();
  const restarted = new WeakSet<FrameLink>();
  const toldSeats = new WeakMap<FrameLink, Map<SeatId, SeatView>>();

  const welcome = (link: FrameLink) => {
    const instance = parent.instance;
    const seat = parent.seat;
    if (!hellos.has(link) || !instance || !seat) return;
    const channels: ChannelCopy[] = [...parent.documents()]
      .filter(([channel]) => scope(channel))
      .map(([channel, document]) => ({ channel, revision: 0, document }));
    revisions.set(
      link,
      new Map(channels.map((copy) => [copy.channel, copy.revision])),
    );
    toldSeats.set(link, rosterOf(parent.seats));
    links.replaceOthers(link);
    // A new controller frame counts its presses from zero; a re-welcome does not.
    if (!restarted.has(link)) {
      restarted.add(link);
      parent.restartInput();
    }
    link.welcomed = true;
    link.send(
      encodeFrame({
        type: "welcome",
        code: parent.code,
        instance,
        seat,
        seats: [...parent.seats],
        channels,
        limits: parent.limits,
        features: [...parent.features],
        host: parent.host,
      }),
    );
  };
  const links = new FrameLinks(welcome);
  const forward = (frame: RoomToPhoneFrame) => {
    const data = encodeFrame(frame);
    for (const link of links.welcomed()) link.send(data);
  };

  const releases = [
    parent.on("status", (status) =>
      links.follow(status, (link) => hellos.has(link)),
    ),
    parent.on("seats", (seats) => {
      for (const link of links.welcomed()) {
        const told = toldSeats.get(link);
        if (!told) continue;
        for (const frame of rosterChanges(told, seats))
          link.send(encodeFrame(frame));
      }
    }),
    parent.on("host", (present) => forward({ type: "host", present })),
    parent.on("signal", (signal) => forward({ type: "signal", ...signal })),
    parent.on("state", ({ channel, document }) => {
      if (!scope(channel)) return;
      for (const link of links.welcomed()) {
        const held = revisions.get(link);
        if (!held) continue;
        const revision = (held.get(channel) ?? 0) + 1;
        held.set(channel, revision);
        link.send(encodeFrame({ type: "state", channel, revision, document }));
      }
    }),
    parent.on("drop", ({ channel }) => {
      if (!scope(channel)) return;
      for (const link of links.welcomed()) revisions.get(link)?.delete(channel);
      forward({ type: "drop", channel });
    }),
  ];

  const receive = (link: FrameLink, data: RoomWireData): void => {
    if (!link.live) return;
    if (!hellos.has(link)) {
      const hello = typeof data === "string" ? parsePhoneHello(data) : null;
      if (!hello) return link.close(closeCode("unsupported-version"));
      hellos.add(link);
      if (parent.status.phase === "open") welcome(link);
      return;
    }
    if (data === PING_FRAME) return link.send(PONG_FRAME);
    if (!link.welcomed) return;
    if (typeof data !== "string") {
      if (data[0] !== INPUT_FRAME_KIND)
        return link.close(closeCode("limits-broken"));
      return parent.sendInputFrame(data.slice());
    }
    const parsed = parsePhoneToRoomFrame(data);
    if (parsed.status === "unknown") return;
    if (parsed.status !== "frame")
      return link.close(closeCode("limits-broken"));
    const frame = parsed.frame;
    switch (frame.type) {
      case "request": {
        if (!scope(frame.channel)) return link.close(closeCode("unauthorised"));
        const id = frame.id;
        void parent
          .request(frame.channel, frame.name, frame.payload)
          .then((outcome) => {
            if (outcome.status === "answered")
              link.send(
                encodeFrame({ type: "response", id, result: outcome.result }),
              );
            else if (outcome.status === "refused")
              link.send(
                encodeFrame({ type: "response", id, refused: outcome.reason }),
              );
          });
        return;
      }
      case "profile": {
        const profile = {
          ...(frame.label === undefined ? {} : { label: frame.label }),
          ...(frame.avatarId === undefined ? {} : { avatarId: frame.avatarId }),
        };
        parent.setProfile(profile);
        options.onProfile?.(profile);
        return;
      }
      case "leave":
        return parent.leave();
    }
  };

  const connector: RoomConnector = (address, handlers) => {
    const link = new FrameLink(handlers);
    if (address.role !== "phone" || links.closed) {
      link.close(closeCode(links.closed ? "closed" : "unauthorised"));
      return { send: () => {}, buffered: () => false, close: () => {} };
    }
    links.add(link);
    if (parent.status.phase === "closed")
      links.follow(parent.status, () => false);
    return {
      send: (data) => receive(link, data),
      buffered: () => false,
      close: () => {
        link.clientClose();
        links.remove(link);
      },
    };
  };

  return {
    connector,
    close: () => {
      links.closeAll(closeCode("closed"));
      for (const release of releases.splice(0)) release();
    },
  };
};
