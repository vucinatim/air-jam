/**
 * One device of `airjam rooms check`: a host or a phone in its own process,
 * so the check can freeze it, kill it and start a replacement; or a load
 * worker running whole rooms, so latency is measured on one clock.
 */
import type { AirJamInput, AirJamInputState } from "@air-jam/sdk/core";
import { type RoomConnector } from "@air-jam/sdk/room-protocol";
import {
  HostRoomSession,
  PhoneRoomSession,
  type RoomSessionStatus,
} from "@air-jam/sdk/room-session";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createCheckConnector } from "../rooms-check-link.js";
import {
  deviceCommandSchema,
  sharedNow,
  type DeviceCommand,
  type DeviceEvent,
  type DeviceLink,
  type LoadResult,
  type RoomTraffic,
} from "../rooms-check-protocol.js";

const controls: AirJamInput = {
  move: { kind: "stick", name: "move", keepDirection: false },
  jump: { kind: "button", name: "jump", mode: "pressed" },
};

/** About the size of a party game's match facts, as Bumper Brawl replicates them. */
const MATCH_FACTS = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => [
    `p${index + 1}`,
    { name: `Player ${index + 1}`, team: index % 2, wins: 0, ready: true },
  ]),
);

const report = (event: DeviceEvent): void => {
  if (process.connected) process.send?.(event);
};

const grants = new Map<number, () => void>();
let nextDial = 0;

/** Waits for the check's grant to open one connection. */
const dial = () =>
  new Promise<void>((resolve) => {
    const id = nextDial;
    nextDial += 1;
    grants.set(id, resolve);
    report({ type: "dial", at: sharedNow(), id });
  });

const grant = (id: number) => {
  const resolve = grants.get(id);
  if (!resolve) throw new Error(`No connection waits for grant ${id}.`);
  grants.delete(id);
  resolve();
};

const connectorFor = (link: DeviceLink, onDialing: () => void): RoomConnector =>
  createCheckConnector({
    url: link.url,
    origin: link.origin,
    dial,
    onDialing,
    onProblem: (problem) =>
      report({ type: "problem", at: sharedNow(), problem }),
  });

const reportDialing = () => report({ type: "dialing", at: sharedNow() });

const run = promisify(exec);

/** One fresh credential from the check's command; hosted grants are spent once. */
const fetchCredential = async (command: string): Promise<string> => {
  const { stdout } = await run(command);
  const credential = stdout.trim();
  if (credential === "")
    throw new Error("The host credential command printed nothing.");
  return credential;
};

const plainStatus = (status: RoomSessionStatus) => ({
  phase: status.phase,
  ...(status.phase === "closed" ? { reason: status.reason } : {}),
});

const presses = (state: AirJamInputState): number => {
  const jump = state.jump;
  return typeof jump === "object" && "presses" in jump ? jump.presses : 0;
};

/** A phone's thumb: the button goes down and up in turn, the stick circles. */
const createThumb = (
  phone: PhoneRoomSession,
  onPress: (count: number) => void,
) => {
  let count = 0;
  let down = false;
  let angle = 0;
  return () => {
    down = !down;
    if (down) {
      count += 1;
      onPress(count);
    }
    angle += 0.3;
    phone.sendInput({
      move: { x: Math.cos(angle) * 0.8, y: Math.sin(angle) * 0.8 },
      jump: { down, presses: count },
    });
  };
};

/** Publishes the match facts with a ticking counter and the time it was published. */
const createTicker = (
  host: HostRoomSession,
  onTick: (tick: number) => void,
) => {
  let tick = 0;
  return () => {
    tick += 1;
    onTick(tick);
    host.publish("game", {
      tick,
      publishedAt: sharedNow(),
      players: MATCH_FACTS,
    });
  };
};

const every = (perSecond: number, work: () => void) => {
  if (perSecond <= 0) return () => {};
  const timer = setInterval(work, 1000 / perSecond);
  return () => clearInterval(timer);
};

let tap: (() => void) | null = null;

const runHost = async (command: Extract<DeviceCommand, { type: "host" }>) => {
  const host = new HostRoomSession({
    connector: connectorFor(command.link, reportDialing),
    key: command.key,
    code: command.code,
    instance: command.instance,
    credential:
      command.instance === undefined && command.credentialCommand
        ? await fetchCredential(command.credentialCommand)
        : undefined,
    seats: command.seats,
    input: controls,
    heartbeat: command.heartbeat ? undefined : null,
    deviceWakeEvents: null,
  });
  const seen = new Map<string, number>();
  const reportStatus = (status: RoomSessionStatus) =>
    report({
      type: "status",
      at: sharedNow(),
      status: plainStatus(status),
      code: host.code,
      instance: host.instance,
      hostGraceMs: host.limits.hostGraceMs,
    });
  reportStatus(host.status);
  host.on("status", reportStatus);
  host.on("seats", (seats) =>
    report({
      type: "seats",
      at: sharedNow(),
      seats: seats.map(({ id, connected }) => ({ id, connected })),
    }),
  );
  host.on("input", ({ seat, state }) => {
    const count = presses(state);
    // The first count a host sees is the wrapped counter itself, so earlier
    // presses cannot be told apart; the frame carrying it did arrive.
    const before = seen.get(seat) ?? count - 1;
    seen.set(seat, count);
    for (let reached = before + 1; reached <= count; reached += 1)
      report({ type: "received", at: sharedNow(), seat, presses: reached });
  });
  let stopTicking = () => {};
  host.on("status", (status) => {
    stopTicking();
    if (status.phase === "open")
      stopTicking = every(
        command.statesPerSecond,
        createTicker(host, (tick) =>
          report({ type: "published", at: sharedNow(), tick }),
        ),
      );
  });
};

const runPhone = (command: Extract<DeviceCommand, { type: "phone" }>) => {
  const phone = new PhoneRoomSession({
    connector: connectorFor(command.link, reportDialing),
    key: command.key,
    code: command.code,
    instance: command.instance,
    input: controls,
    deviceWakeEvents: null,
  });
  const reportStatus = (status: RoomSessionStatus) =>
    report({
      type: "status",
      at: sharedNow(),
      status: plainStatus(status),
      code: phone.code,
      instance: phone.instance,
      seat: phone.seat ?? undefined,
    });
  reportStatus(phone.status);
  phone.on("status", reportStatus);
  phone.on("host", (present) =>
    report({ type: "host", at: sharedNow(), present }),
  );
  phone.on("state", ({ document }) => {
    if (typeof document.tick === "number")
      report({ type: "state", at: sharedNow(), tick: document.tick });
  });
  const step = createThumb(phone, (count) =>
    report({ type: "pressed", at: sharedNow(), presses: count }),
  );
  tap = () => {
    step();
    step();
  };
  every(command.inputsPerSecond, step);
};

const metered =
  (connector: RoomConnector, traffic: RoomTraffic): RoomConnector =>
  (address, handlers) => {
    const size = (data: string | Uint8Array) =>
      typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
    const link = connector(address, {
      ...handlers,
      message: (data) => {
        traffic.messagesOut += 1;
        traffic.bytesOut += size(data);
        handlers.message(data);
      },
    });
    return {
      send: (data) => {
        traffic.messagesIn += 1;
        traffic.bytesIn += size(data);
        link.send(data);
      },
      close: () => link.close(),
    };
  };

/** The first value `read` gives within the deadline, or null. */
const until = <Value>(read: () => Value | null, deadlineMs: number) =>
  new Promise<Value | null>((resolve) => {
    const deadline = Date.now() + deadlineMs;
    const check = () => {
      const value = read();
      if (value !== null) resolve(value);
      else if (Date.now() > deadline) resolve(null);
      else setTimeout(check, 20);
    };
    check();
  });

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Long enough for any connection to get its grant, however slowly the check paces opens. */
const GRANT_DEADLINE_MS = 30 * 60_000;
const OPEN_DEADLINE_MS = 30_000;

const runLoad = async (command: Extract<DeviceCommand, { type: "load" }>) => {
  const cpuAtStart = process.cpuUsage();
  const traffic: RoomTraffic = {
    messagesIn: 0,
    bytesIn: 0,
    messagesOut: 0,
    bytesOut: 0,
  };
  const result: Omit<LoadResult, "traffic" | "cpuMs"> = {
    roomsOpened: 0,
    phonesJoined: 0,
    roomOpenMs: [],
    phoneJoinMs: [],
    inputLatencyMs: [],
    pressesSent: 0,
    pressesLost: 0,
    stateLatencyMs: [],
  };
  const stops: Array<() => void> = [];
  const sessions: Array<{ close(): void }> = [];
  const pending: Array<Map<number, number>> = [];
  let measuring = false;

  /** One session's metered connector, and how long its first connection took to open from dialing. */
  const sessionLink = () => {
    const times: { dialed: number | null; opened: number | null } = {
      dialed: null,
      opened: null,
    };
    return {
      connector: metered(
        connectorFor(command.link, () => {
          times.dialed ??= sharedNow();
        }),
        traffic,
      ),
      onStatus: (status: RoomSessionStatus) => {
        if (status.phase === "open") times.opened ??= sharedNow();
      },
      openMs: async (): Promise<number | null> => {
        const dialedAt = await until(() => times.dialed, GRANT_DEADLINE_MS);
        if (dialedAt === null) return null;
        const openedAt = await until(() => times.opened, OPEN_DEADLINE_MS);
        return openedAt === null ? null : openedAt - dialedAt;
      },
    };
  };

  const openLoadRoom = async (room: number) => {
    const hostLink = sessionLink();
    const host = new HostRoomSession({
      connector: hostLink.connector,
      key: `load-host-${room}-${crypto.randomUUID()}`,
      credential: command.credentialCommand
        ? await fetchCredential(command.credentialCommand)
        : undefined,
      seats: command.phonesPerRoom,
      input: controls,
      deviceWakeEvents: null,
    });
    host.on("status", hostLink.onStatus);
    sessions.push(host);
    const roomOpenMs = await hostLink.openMs();
    const code = host.code;
    if (roomOpenMs === null || code === undefined) return;
    result.roomsOpened += 1;
    result.roomOpenMs.push(roomOpenMs);
    const sentBySeat = new Map<string, Map<number, number>>();
    const seen = new Map<string, number>();
    host.on("input", ({ seat, state }) => {
      const count = presses(state);
      const before = seen.get(seat) ?? count - 1;
      seen.set(seat, count);
      const sent = sentBySeat.get(seat);
      for (let reached = before + 1; reached <= count; reached += 1) {
        const at = sent?.get(reached);
        if (at === undefined) continue;
        sent?.delete(reached);
        if (measuring) result.inputLatencyMs.push(sharedNow() - at);
      }
    });
    await Promise.all(
      Array.from({ length: command.phonesPerRoom }, async (_, index) => {
        const phoneLink = sessionLink();
        const phone = new PhoneRoomSession({
          connector: phoneLink.connector,
          key: `load-phone-${room}-${index}-${crypto.randomUUID()}`,
          code,
          input: controls,
          deviceWakeEvents: null,
        });
        phone.on("status", phoneLink.onStatus);
        sessions.push(phone);
        phone.on("state", ({ document }) => {
          if (measuring && typeof document.publishedAt === "number")
            result.stateLatencyMs.push(sharedNow() - document.publishedAt);
        });
        const phoneJoinMs = await phoneLink.openMs();
        const seat = phone.seat;
        if (phoneJoinMs === null || seat === null) return;
        result.phonesJoined += 1;
        result.phoneJoinMs.push(phoneJoinMs);
        const sent = new Map<number, number>();
        sentBySeat.set(seat, sent);
        pending.push(sent);
        const step = createThumb(phone, (count) => {
          if (!measuring) return;
          result.pressesSent += 1;
          sent.set(count, sharedNow());
        });
        await wait(Math.random() * (1000 / command.inputsPerSecond));
        stops.push(every(command.inputsPerSecond, step));
      }),
    );
    stops.push(
      every(
        command.statesPerSecond,
        createTicker(host, () => {}),
      ),
    );
  };

  // Rooms open one after another, so each host's credential is fresh when
  // its connection is granted.
  for (let room = 0; room < command.rooms; room += 1) await openLoadRoom(room);

  measuring = true;
  const trafficAtStart = { ...traffic };
  await wait(command.durationMs);
  measuring = false;
  const measured: RoomTraffic = {
    messagesIn: traffic.messagesIn - trafficAtStart.messagesIn,
    bytesIn: traffic.bytesIn - trafficAtStart.bytesIn,
    messagesOut: traffic.messagesOut - trafficAtStart.messagesOut,
    bytesOut: traffic.bytesOut - trafficAtStart.bytesOut,
  };
  for (const stop of stops) stop();
  await wait(1_000);
  result.pressesLost = pending.reduce((lost, sent) => lost + sent.size, 0);
  for (const session of sessions) session.close();
  const cpu = process.cpuUsage(cpuAtStart);
  report({
    type: "load",
    at: sharedNow(),
    result: {
      ...result,
      traffic: measured,
      cpuMs: (cpu.user + cpu.system) / 1000,
    },
  });
};

const reportFailure = (error: unknown) =>
  report({
    type: "failed",
    at: sharedNow(),
    message: (error instanceof Error ? error.message : String(error)).trim(),
  });

process.on("message", (message: unknown) => {
  const command = deviceCommandSchema.parse(message);
  switch (command.type) {
    case "host":
      return void runHost(command).catch(reportFailure);
    case "phone":
      return runPhone(command);
    case "press":
      return tap?.();
    case "dial":
      return grant(command.id);
    case "load":
      return void runLoad(command).catch(reportFailure);
  }
});
process.on("disconnect", () => process.exit(0));
