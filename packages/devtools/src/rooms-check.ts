import { createRoomKey } from "@air-jam/sdk/room-session";
import { availableParallelism } from "node:os";
import {
  ConnectionPacer,
  Device,
  Fleet,
  isOpen,
  ScenarioFailure,
} from "./rooms-check-fleet.js";
import {
  DEFAULT_ROOMS_CHECK_SCENARIOS,
  sharedNow,
  summarizeLatency,
  type LoadResult,
  type RoomsCheckReport,
  type RoomsCheckScenario,
  type RoomsCheckScenarioResult,
} from "./rooms-check-protocol.js";

export {
  DEFAULT_ROOMS_CHECK_SCENARIOS,
  describeLinkProblem,
  ROOMS_CHECK_SCENARIOS,
  type ConnectionProblem,
  type LatencySummary,
  type LinkProblem,
  type RoomsCheckReport,
  type RoomsCheckScenario,
  type RoomsCheckScenarioResult,
} from "./rooms-check-protocol.js";

export interface RoomsCheckLoadOptions {
  readonly rooms?: number;
  readonly phonesPerRoom?: number;
  readonly durationMs?: number;
  /** Processes the rooms are spread over; each runs whole rooms on one clock. */
  readonly workers?: number;
}

export interface RoomsCheckOptions {
  /** The rooms origin, such as `wss://rooms.example.com` or `http://localhost:4000`. */
  readonly url: string;
  /** The page origin every connection names in its Origin header, for a gate that checks it. */
  readonly origin?: string;
  /**
   * A shell command printing one host credential, run for every host that
   * opens a room, since a hosted grant is spent once; a host resuming its
   * room runs none.
   */
  readonly hostCredentialCommand?: string;
  /** At most this many connection opens in any minute, across every device; unpaced when omitted. */
  readonly connectionsPerMinute?: number;
  readonly scenarios?: readonly RoomsCheckScenario[];
  /** A lock shorter than any server's liveness window, which must not cost the seat. */
  readonly briefFreezeMs?: number;
  /** How long the background-host room sits idle. */
  readonly idleMs?: number;
  readonly crowdDurationMs?: number;
  readonly load?: RoomsCheckLoadOptions;
  readonly onResult?: (result: RoomsCheckScenarioResult) => void;
}

const PRESS_COUNTER_SIZE = 128;
const OPEN_DEADLINE_MS = 15_000;
/** Long enough for any connection to get its grant, however slowly the check paces opens. */
const GRANT_DEADLINE_MS = 30 * 60_000;
/** Bytes of TLS, WebSocket and TCP/IP framing around each message, as the hosting plan measured. */
const WIRE_FRAMING_BYTES = 78;
const HOUR_MS = 3_600_000;

interface Phone {
  readonly device: Device;
  readonly key: string;
  readonly seat: string;
  readonly instance: string;
}

interface OpenRoom {
  readonly host: Device;
  readonly hostKey: string;
  readonly code: string;
  readonly instance: string;
  readonly hostGraceMs: number;
  readonly openMs: number;
  readonly phones: Phone[];
  readonly joinMs: number[];
}

/** When the device's first connection began opening, after its process started and its grant came. */
const dialed = (device: Device) =>
  device.until(
    (event) => (event.type === "dialing" ? event.at : undefined),
    "dialing",
    GRANT_DEADLINE_MS,
  );

/** The device's first open status, counted from when it dialed; a session the room ends for good fails it at once. */
const firstOpen = async (device: Device, what: string) => {
  const dialedAt = await dialed(device);
  const outcome = await device.until(
    (event) =>
      event.type === "status" &&
      (event.status.phase === "open" || event.status.phase === "closed")
        ? event
        : undefined,
    what,
    OPEN_DEADLINE_MS,
  );
  if (outcome.status.phase === "closed")
    throw new ScenarioFailure(
      `${device.name}: ${what} ended with the room closing it as ${outcome.status.reason}.`,
    );
  return { opened: outcome, openMs: outcome.at - dialedAt };
};

const field = <Value>(value: Value | undefined, what: string): Value => {
  if (value === undefined)
    throw new ScenarioFailure(`The room did not report its ${what}.`);
  return value;
};

const joinPhone = async (
  fleet: Fleet,
  name: string,
  room: { code: string },
  options: { key?: string; instance?: string; inputsPerSecond: number },
): Promise<Phone & { joinMs: number }> => {
  const device = fleet.device(name);
  const key = options.key ?? createRoomKey();
  device.send({
    type: "phone",
    link: fleet.link,
    key,
    code: room.code,
    instance: options.instance,
    inputsPerSecond: options.inputsPerSecond,
  });
  const { opened, openMs } = await firstOpen(device, "joining");
  return {
    device,
    key,
    seat: field(opened.seat, "seat"),
    instance: field(opened.instance, "instance"),
    joinMs: openMs,
  };
};

const openRoom = async (
  fleet: Fleet,
  options: {
    phones: number;
    inputsPerSecond?: number;
    statesPerSecond?: number;
    hostHeartbeat?: boolean;
  },
): Promise<OpenRoom> => {
  const host = fleet.device("host");
  const hostKey = createRoomKey();
  host.send({
    type: "host",
    link: fleet.link,
    credentialCommand: fleet.hostCredentialCommand,
    key: hostKey,
    seats: Math.max(options.phones, 2),
    statesPerSecond: options.statesPerSecond ?? 0,
    heartbeat: options.hostHeartbeat ?? true,
  });
  const { opened, openMs } = await firstOpen(host, "opening the room");
  const code = field(opened.code, "code");
  const joined = await Promise.all(
    Array.from({ length: options.phones }, (_, index) =>
      joinPhone(
        fleet,
        `phone ${index + 1}`,
        { code },
        {
          inputsPerSecond: options.inputsPerSecond ?? 30,
        },
      ),
    ),
  );
  return {
    host,
    hostKey,
    code,
    instance: field(opened.instance, "instance"),
    hostGraceMs: field(opened.hostGraceMs, "host grace"),
    openMs,
    phones: joined,
    joinMs: joined.map((phone) => phone.joinMs),
  };
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const sameCount = (left: number, right: number) =>
  left % PRESS_COUNTER_SIZE === right % PRESS_COUNTER_SIZE;

/**
 * Tap-to-host times for presses made between `from` and `to`. A host counts
 * presses from the first state it saw, so counts are matched within the
 * counter's wrap; a press is lost when no host saw it within a second.
 */
const measureInput = (
  host: Device,
  phones: readonly Phone[],
  from: number,
  to: number,
) => {
  const latencies: number[] = [];
  let pressed = 0;
  let lost = 0;
  for (const phone of phones) {
    const received = host
      .since("received", from)
      .filter((event) => event.seat === phone.seat);
    for (const press of phone.device.since("pressed", from, to)) {
      pressed += 1;
      const arrival = received.find(
        (event) =>
          event.at >= press.at &&
          event.at - press.at < 1_000 &&
          sameCount(event.presses, press.presses),
      );
      if (arrival) latencies.push(arrival.at - press.at);
      else lost += 1;
    }
  }
  return { pressed, lost, latency: summarizeLatency(latencies) };
};

const measureState = (host: Device, phones: readonly Phone[], from: number) => {
  const published = new Map(
    host.since("published", from).map((event) => [event.tick, event.at]),
  );
  return summarizeLatency(
    phones.flatMap((phone) =>
      phone.device.since("state", from).flatMap((event) => {
        const at = published.get(event.tick);
        return at === undefined ? [] : [event.at - at];
      }),
    ),
  );
};

const firstInputAfter = (host: Device, seat: string | null, after: number) =>
  host.until(
    (event) =>
      event.type === "received" && (seat === null || event.seat === seat)
        ? event.at
        : undefined,
    "an input arriving",
    OPEN_DEADLINE_MS,
    after,
  );

const seatDropped = (host: Device, seat: string, from: number) =>
  host
    .since("seats", from)
    .some((event) =>
      event.seats.some((view) => view.id === seat && !view.connected),
    );

type ScenarioContext = {
  readonly fleet: Fleet;
  readonly options: Required<
    Pick<RoomsCheckOptions, "briefFreezeMs" | "idleMs" | "crowdDurationMs">
  > & {
    readonly load: Required<RoomsCheckLoadOptions>;
  };
};

type Scenario = (context: ScenarioContext) => Promise<Record<string, unknown>>;

const scenarios: Record<RoomsCheckScenario, Scenario> = {
  /** The smallest room: a host and one phone, input one way and state the other. */
  join: async ({ fleet }) => {
    const room = await openRoom(fleet, { phones: 1, statesPerSecond: 20 });
    const from = sharedNow();
    await wait(2_000);
    const to = sharedNow() - 500;
    const input = measureInput(room.host, room.phones, from, to);
    if (input.pressed === 0 || input.lost > 0)
      throw new ScenarioFailure(
        `${input.lost} of ${input.pressed} presses never reached the host.`,
      );
    return {
      roomOpenMs: room.openMs,
      phoneJoinMs: room.joinMs[0],
      input: input.latency,
      state: measureState(room.host, room.phones, from),
    };
  },

  /** A phone locked for a moment keeps its seat and its link. */
  "phone-brief-freeze": async ({ fleet, options }) => {
    const room = await openRoom(fleet, { phones: 1 });
    const [phone] = room.phones;
    if (!phone) throw new ScenarioFailure("No phone joined.");
    const frozenAt = sharedNow();
    phone.device.freeze();
    await wait(options.briefFreezeMs);
    const thawedAt = sharedNow();
    phone.device.thaw();
    const arrived = await firstInputAfter(room.host, phone.seat, thawedAt);
    if (seatDropped(room.host, phone.seat, frozenAt))
      throw new ScenarioFailure(
        `The host saw the seat drop during a ${options.briefFreezeMs} ms lock.`,
      );
    return {
      freezeMs: options.briefFreezeMs,
      thawToInputMs: arrived - thawedAt,
    };
  },

  /** A phone locked past the server's liveness window gets its seat back on waking. */
  "phone-long-freeze": async ({ fleet }) => {
    const room = await openRoom(fleet, { phones: 1 });
    const [phone] = room.phones;
    if (!phone) throw new ScenarioFailure("No phone joined.");
    const frozenAt = sharedNow();
    phone.device.freeze();
    const droppedAt = await room.host.until(
      (event) =>
        event.type === "seats" &&
        event.seats.some((view) => view.id === phone.seat && !view.connected)
          ? event.at
          : undefined,
      "the server noticing the silent phone",
      120_000,
      frozenAt,
    );
    const thawedAt = sharedNow();
    phone.device.thaw();
    const reopened = await phone.device.until(
      (event) => (isOpen(event) ? event : undefined),
      "rejoining",
      OPEN_DEADLINE_MS,
      thawedAt,
    );
    if (reopened.seat !== phone.seat)
      throw new ScenarioFailure(
        `The phone came back as ${reopened.seat}, not ${phone.seat}.`,
      );
    const arrived = await firstInputAfter(room.host, phone.seat, thawedAt);
    return {
      silenceNoticedMs: droppedAt - frozenAt,
      thawToRejoinMs: reopened.at - thawedAt,
      thawToInputMs: arrived - thawedAt,
    };
  },

  /** Wi-Fi to cellular: a new link with the key takes the seat at once; the dead one stays out. */
  "network-switch": async ({ fleet }) => {
    const room = await openRoom(fleet, { phones: 1 });
    const [wifi] = room.phones;
    if (!wifi) throw new ScenarioFailure("No phone joined.");
    wifi.device.freeze();
    const cellular = await joinPhone(fleet, "phone on cellular", room, {
      key: wifi.key,
      instance: wifi.instance,
      inputsPerSecond: 30,
    });
    if (cellular.seat !== wifi.seat)
      throw new ScenarioFailure(
        `The new link took ${cellular.seat}, not ${wifi.seat}.`,
      );
    const takenAt = sharedNow();
    wifi.device.thaw();
    await wifi.device.until(
      (event) =>
        event.type === "status" &&
        event.status.phase === "closed" &&
        event.status.reason === "replaced"
          ? true
          : undefined,
      "the old link stopping as replaced",
      OPEN_DEADLINE_MS,
      takenAt,
    );
    await wait(2_000);
    if (seatDropped(room.host, wifi.seat, takenAt))
      throw new ScenarioFailure("The seat changed hands back and forth.");
    await firstInputAfter(room.host, wifi.seat, sharedNow() - 1_000);
    return { takeoverMs: cellular.joinMs };
  },

  /** Two tabs join with one key at once: one seat, and the older tab stops. */
  "duplicate-join": async ({ fleet }) => {
    const room = await openRoom(fleet, { phones: 0 });
    const key = createRoomKey();
    const tabs = ["tab 1", "tab 2"].map((name) => {
      const device = fleet.device(name);
      device.send({
        type: "phone",
        link: fleet.link,
        key,
        code: room.code,
        inputsPerSecond: 0,
      });
      return device;
    });
    await Promise.all(tabs.map(dialed));
    const outcomes = await Promise.all(
      tabs.map((tab) =>
        tab
          .until(
            (event) =>
              event.type === "status" && event.status.phase === "closed"
                ? (event.status.reason ?? "closed")
                : undefined,
            "one tab replacing the other",
            3_000,
          )
          .catch(() => "open"),
      ),
    );
    const seats = room.host.since("seats").at(-1)?.seats ?? [];
    if (
      outcomes.filter((outcome) => outcome === "open").length !== 1 ||
      !outcomes.includes("replaced")
    )
      throw new ScenarioFailure(`The tabs ended ${outcomes.join(" and ")}.`);
    if (seats.length !== 1 || !seats[0]?.connected)
      throw new ScenarioFailure(`The host saw ${seats.length} seats.`);
    return { seats: seats.length };
  },

  /** A host that reloads within its grace gets its room, seats and input back. */
  "host-reload": async ({ fleet }) => {
    const room = await openRoom(fleet, { phones: 2 });
    const killedAt = sharedNow();
    room.host.kill();
    await Promise.all(
      room.phones.map((phone) =>
        phone.device.until(
          (event) =>
            event.type === "host" && !event.present ? true : undefined,
          "seeing the screen go away",
          OPEN_DEADLINE_MS,
          killedAt,
        ),
      ),
    );
    const reloaded = fleet.device("reloaded host");
    reloaded.send({
      type: "host",
      link: fleet.link,
      credentialCommand: fleet.hostCredentialCommand,
      key: room.hostKey,
      code: room.code,
      instance: room.instance,
      seats: 2,
      statesPerSecond: 0,
      heartbeat: true,
    });
    const { opened } = await firstOpen(reloaded, "reclaiming the room");
    if (opened.code !== room.code)
      throw new ScenarioFailure(`The host came back to ${opened.code}.`);
    const seats = await reloaded.until(
      (event) => (event.type === "seats" ? event.seats : undefined),
      "seeing the seats",
      OPEN_DEADLINE_MS,
    );
    if (seats.length !== 2)
      throw new ScenarioFailure(
        `The reloaded host found ${seats.length} seats.`,
      );
    const arrived = await firstInputAfter(reloaded, null, opened.at);
    return {
      killToReclaimMs: opened.at - killedAt,
      killToInputMs: arrived - killedAt,
    };
  },

  /** A host gone past its grace ends the room, and its phones stop for good. */
  "host-gone": async ({ fleet }) => {
    const room = await openRoom(fleet, { phones: 1 });
    const [phone] = room.phones;
    if (!phone) throw new ScenarioFailure("No phone joined.");
    const killedAt = sharedNow();
    room.host.kill();
    const closedAt = await phone.device.until(
      (event) =>
        event.type === "status" &&
        event.status.phase === "closed" &&
        event.status.reason === "closed"
          ? event.at
          : undefined,
      "the room closing",
      room.hostGraceMs + OPEN_DEADLINE_MS,
      killedAt,
    );
    return {
      hostGraceMs: room.hostGraceMs,
      killToClosedMs: closedAt - killedAt,
    };
  },

  /** A hidden host tab sends no pings of its own; the server's keep it, idle or not. */
  "background-host": async ({ fleet, options }) => {
    const room = await openRoom(fleet, {
      phones: 1,
      inputsPerSecond: 0,
      hostHeartbeat: false,
    });
    const [phone] = room.phones;
    if (!phone) throw new ScenarioFailure("No phone joined.");
    const idleFrom = sharedNow();
    await wait(options.idleMs);
    const tappedAt = sharedNow();
    phone.device.send({ type: "press" });
    const arrived = await firstInputAfter(room.host, phone.seat, tappedAt);
    const away = phone.device
      .since("host", idleFrom)
      .some((event) => !event.present);
    if (away) throw new ScenarioFailure("The idle host was dropped.");
    return { idleMs: options.idleMs, tapToHostMs: arrived - tappedAt };
  },

  /** Sixteen phones at 30 Hz and a host publishing at 20 Hz. */
  crowd: async ({ fleet, options }) => {
    const room = await openRoom(fleet, { phones: 16, statesPerSecond: 20 });
    const from = sharedNow();
    await wait(options.crowdDurationMs);
    const to = sharedNow() - 500;
    const input = measureInput(room.host, room.phones, from, to);
    if (input.lost > 0)
      throw new ScenarioFailure(
        `${input.lost} of ${input.pressed} presses never reached the host.`,
      );
    return {
      phoneJoinMs: summarizeLatency(room.joinMs),
      input: input.latency,
      state: measureState(room.host, room.phones, from),
    };
  },

  /** Many rooms at once: the numbers a hosting decision needs. */
  load: async ({ fleet, options }) => {
    const { rooms, phonesPerRoom, durationMs, workers } = options.load;
    const shares = Array.from(
      { length: workers },
      (_, index) =>
        Math.floor(rooms / workers) + (index < rooms % workers ? 1 : 0),
    ).filter((share) => share > 0);
    const results = await Promise.all(
      shares.map((share, index) => {
        const worker = fleet.device(`load worker ${index + 1}`);
        worker.send({
          type: "load",
          link: fleet.link,
          credentialCommand: fleet.hostCredentialCommand,
          rooms: share,
          phonesPerRoom,
          inputsPerSecond: 30,
          statesPerSecond: 20,
          durationMs,
        });
        return worker.until(
          (event) =>
            event.type === "load" || event.type === "failed"
              ? event
              : undefined,
          "finishing its rooms",
          GRANT_DEADLINE_MS + durationMs,
        );
      }),
    );
    return summarizeLoad(
      results.map((event) => {
        if (event.type === "failed") throw new ScenarioFailure(event.message);
        return event.result;
      }),
      { rooms, phonesPerRoom, durationMs },
    );
  },
};

const summarizeLoad = (
  results: readonly LoadResult[],
  {
    rooms,
    phonesPerRoom,
    durationMs,
  }: { rooms: number; phonesPerRoom: number; durationMs: number },
) => {
  const total = <Key extends keyof LoadResult>(key: Key) =>
    results.reduce((sum, result) => sum + (result[key] as number), 0);
  const all = (
    key: "roomOpenMs" | "phoneJoinMs" | "inputLatencyMs" | "stateLatencyMs",
  ) => results.flatMap((result) => result[key]);
  const traffic = results.reduce(
    (sum, result) => ({
      messagesIn: sum.messagesIn + result.traffic.messagesIn,
      bytesIn: sum.bytesIn + result.traffic.bytesIn,
      messagesOut: sum.messagesOut + result.traffic.messagesOut,
      bytesOut: sum.bytesOut + result.traffic.bytesOut,
    }),
    { messagesIn: 0, bytesIn: 0, messagesOut: 0, bytesOut: 0 },
  );
  const roomHours = (total("roomsOpened") * durationMs) / HOUR_MS;
  const perRoomHour = (value: number) =>
    roomHours === 0 ? null : Math.round(value / roomHours);
  const roomsOpened = total("roomsOpened");
  const phonesJoined = total("phonesJoined");
  const pressesLost = total("pressesLost");
  if (
    roomsOpened < rooms ||
    phonesJoined < rooms * phonesPerRoom ||
    pressesLost > 0
  )
    throw new ScenarioFailure(
      `${roomsOpened} of ${rooms} rooms opened, ${phonesJoined} of ${rooms * phonesPerRoom} phones joined, ${pressesLost} presses lost.`,
    );
  return {
    rooms: roomsOpened,
    phones: phonesJoined,
    durationMs,
    roomOpen: summarizeLatency(all("roomOpenMs")),
    phoneJoin: summarizeLatency(all("phoneJoinMs")),
    input: summarizeLatency(all("inputLatencyMs")),
    pressesSent: total("pressesSent"),
    pressesLost,
    state: summarizeLatency(all("stateLatencyMs")),
    perRoomHour: {
      messagesIn: perRoomHour(traffic.messagesIn),
      messagesOut: perRoomHour(traffic.messagesOut),
      payloadBytesOut: perRoomHour(traffic.bytesOut),
      wireBytesOutWithTls: perRoomHour(
        traffic.bytesOut + WIRE_FRAMING_BYTES * traffic.messagesOut,
      ),
    },
    clientCpuMs: Math.round(total("cpuMs")),
  };
};

/**
 * Runs the hosting plan's edge cases against a rooms address, with the host
 * and each phone as separate processes that are frozen, killed and replaced
 * as locked phones, closed tabs and network switches would be, and the load
 * scenario when asked for. The target is only a URL, so any room server can
 * be checked the same way.
 */
export const runRoomsCheck = async (
  options: RoomsCheckOptions,
): Promise<RoomsCheckReport> => {
  const pacer =
    options.connectionsPerMinute === undefined
      ? null
      : new ConnectionPacer(options.connectionsPerMinute);
  const target = {
    link: { url: options.url, origin: options.origin },
    hostCredentialCommand: options.hostCredentialCommand,
  };
  const resolved: ScenarioContext["options"] = {
    briefFreezeMs: options.briefFreezeMs ?? 5_000,
    idleMs: options.idleMs ?? 60_000,
    crowdDurationMs: options.crowdDurationMs ?? 10_000,
    load: {
      rooms: options.load?.rooms ?? 100,
      phonesPerRoom: options.load?.phonesPerRoom ?? 4,
      durationMs: options.load?.durationMs ?? 60_000,
      workers:
        options.load?.workers ??
        Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2))),
    },
  };
  const results: RoomsCheckScenarioResult[] = [];
  for (const scenario of options.scenarios ?? DEFAULT_ROOMS_CHECK_SCENARIOS) {
    const fleet = new Fleet(target, pacer);
    const startedAt = sharedNow();
    let result: RoomsCheckScenarioResult;
    try {
      const measurements = await scenarios[scenario]({
        fleet,
        options: resolved,
      });
      result = {
        scenario,
        passed: true,
        durationMs: Math.round(sharedNow() - startedAt),
        measurements: roundAll(measurements),
        connectionProblems: fleet.problems(startedAt),
      };
    } catch (error) {
      if (!(error instanceof ScenarioFailure)) throw error;
      result = {
        scenario,
        passed: false,
        failure: error.message,
        durationMs: Math.round(sharedNow() - startedAt),
        measurements: {},
        connectionProblems: fleet.problems(startedAt),
      };
    } finally {
      fleet.close();
    }
    results.push(result);
    options.onResult?.(result);
  }
  return {
    url: options.url,
    passed: results.every((result) => result.passed),
    scenarios: results,
  };
};

const roundAll = (
  measurements: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(measurements).map(([key, value]) => [
      key,
      typeof value === "number" ? Math.round(value * 100) / 100 : value,
    ]),
  );
