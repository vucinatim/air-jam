import type { AirJamHostEnvironment } from "../../src/core/environment";
import {
  DEFAULT_ROOM_LIMITS,
  type SeatView,
  type StateDocument,
} from "../../src/room-protocol";
import type { PublishOptions } from "../../src/room-session/channel-state";
import type {
  HostRoom,
  HostSessionEvents,
} from "../../src/room-session/host-room-session";
import { Listeners } from "../../src/room-session/listeners";
import type { RoomSessionStatus } from "../../src/room-session/session-link";

/**
 * A host's room with no network: open at once, it records what the runtime
 * publishes, signals and answers, and delivers the seats, input and requests
 * a test fires, exactly when it fires them.
 */
export const createMemoryRoom = (code = "ROOM1", instance = "instance-1") => {
  const events = new Listeners<HostSessionEvents>();
  const seats = new Map<string, SeatView>();
  const published = new Map<
    string,
    { document: StateDocument; options: PublishOptions }
  >();
  const responses: Array<{ seat: string; id: number; result: unknown }> = [];
  const signals: Array<{ kind: string; payload: unknown; seat?: string }> = [];
  let status: RoomSessionStatus = { phase: "open" };
  let nextRequest = 1;
  const room: HostRoom = {
    on: events.on.bind(events),
    get status() {
      return status;
    },
    code,
    instance,
    get seats() {
      return [...seats.values()];
    },
    limits: DEFAULT_ROOM_LIMITS,
    room: {
      seatsWanted: DEFAULT_ROOM_LIMITS.seats,
      locked: false,
      activity: null,
      features: [],
    },
    roomCopies: [],
    channels: () =>
      [...published].map(([channel, { document, options }]) => ({
        channel,
        revision: 0,
        document,
        ...options,
      })),
    publish: (channel, document, options = {}) => {
      published.set(channel, { document, options });
    },
    drop: (channel) => {
      published.delete(channel);
    },
    respond: (seat, id, result) => {
      responses.push({ seat, id, result });
    },
    signal: (kind, payload, seat) => {
      signals.push({ kind, payload, ...(seat ? { seat } : {}) });
    },
    configure: () => {},
    remove: (seat) => {
      seats.delete(seat);
      events.emit("seats", [...seats.values()]);
    },
    setActivity: () => {},
    end: () => {},
    close: () => {
      status = { phase: "closed", reason: "owner" };
    },
  };
  return {
    room,
    published,
    responses,
    signals,
    seat: (
      seat: Omit<SeatView, "color" | "kind" | "connected"> & Partial<SeatView>,
    ) => {
      seats.set(seat.id, {
        color: "#ff0000",
        kind: "phone",
        connected: true,
        ...seat,
      });
      events.emit("seats", [...seats.values()]);
    },
    left: (seat: string) => {
      seats.delete(seat);
      events.emit("seats", [...seats.values()]);
    },
    input: (seat: string, state: Record<string, unknown>) =>
      events.emit("input", { seat, state: state as never }),
    /** A phone's request; returns what the host answered, if it did. */
    request: (
      seat: string,
      channel: string,
      name: string,
      payload?: unknown,
    ) => {
      const id = nextRequest++;
      events.emit("request", { seat, id, channel, name, payload });
      return responses.find((response) => response.id === id)?.result;
    },
    setStatus: (next: RoomSessionStatus) => {
      status = next;
      events.emit("status", next);
    },
  };
};

export const createMemoryEnvironment = (
  memory: ReturnType<typeof createMemoryRoom> = createMemoryRoom(),
) => {
  let resume: { key: string; code: string; instance: string } | null = null;
  const environment: AirJamHostEnvironment = {
    embedded: null,
    requestedRoomId: null,
    runMode: "standalone",
    defaultStoreDomain: "default",
    presentationChannel: "airjam.room",
    controlTarget: {},
    openRoom: () => memory.room,
    createKey: () => "host-key-00000001",
    readResume: () => resume,
    writeResume: (next) => {
      resume = next;
    },
    requestHostGrant: async () => "grant",
    controllerUrls: async (roomId) => ({
      joinUrl: `https://play.test/controller?room=${roomId}`,
      localControllerUrl: `https://play.test/controller?room=${roomId}`,
    }),
    reportError: () => {},
    emitDevEvent: () => {},
    setDevLogContext: () => {},
    seed: () => 1,
    now: () => performance.now(),
  };
  return { environment, memory, readStoredResume: () => resume };
};
