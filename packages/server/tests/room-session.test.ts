import type { AirJamInput } from "@air-jam/sdk/core";
import {
  DEFAULT_ROOM_LIMITS,
  encodeInputPayload,
  encodePhoneInputFrame,
} from "@air-jam/sdk/room-protocol";
import {
  createLoopbackConnector,
  createPortConnector,
  HostRoomSession,
  PhoneInputLane,
  PhoneRoomSession,
  serveRoomPort,
  type PhoneSessionOptions,
} from "@air-jam/sdk/room-session";
import { describe, expect, it } from "vitest";
import {
  createNetwork,
  createRooms,
  ManualClock,
  settle,
} from "./helpers/room-session-harness.js";

const HOST_KEY = "host-key-00000001";
const PHONE_KEY = "phone-key-0000001";
const controls: AirJamInput = {
  move: { kind: "stick", name: "move", keepDirection: false },
  jump: { kind: "button", name: "jump", mode: "pressed" },
};
const controlsAt = (x: number, presses = 0, down = false) => ({
  move: { x, y: 0 },
  jump: { down, presses },
});

const openRoom = async () => {
  const clock = new ManualClock();
  const rooms = createRooms(clock);
  const network = createNetwork(rooms);
  const common = {
    connector: network.connector,
    clock,
    random: () => 0.5,
    deviceWakeEvents: null,
  };
  const host = new HostRoomSession({
    ...common,
    key: HOST_KEY,
    seats: 4,
    input: controls,
  });
  await clock.advance();
  const code = host.code;
  if (code === undefined) throw new Error("The host has no room.");
  const join = (key = PHONE_KEY, options: Partial<PhoneSessionOptions> = {}) =>
    new PhoneRoomSession({ ...common, key, code, input: controls, ...options });
  return { clock, rooms, network, common, host, join };
};

const parsedText = (sent: ReadonlyArray<string | Uint8Array>) =>
  sent.flatMap((data) =>
    typeof data === "string" && data !== "ping"
      ? [JSON.parse(data) as { type: string }]
      : [],
  );

describe("room sessions over a loopback room", () => {
  it("lets a phone join, send input and requests, and mirror the host's state", async () => {
    const { clock, host, join } = await openRoom();
    const inputs: unknown[] = [];
    host.on("input", (input) => inputs.push(input));
    host.on("request", (request) =>
      host.respond(request.seat, request.id, { echoed: request.payload }),
    );
    host.publish("game", { phase: "lobby", scores: { p1: 0 } });
    const player = join(PHONE_KEY, { profile: { label: "Ana" } });
    await clock.advance();

    expect(player.status).toEqual({ phase: "open" });
    expect(player.seat).toBe("p1");
    expect(
      host.seats.map((seat) => [seat.id, seat.label, seat.connected]),
    ).toEqual([["p1", "Ana", true]]);
    expect(player.channel("game")).toEqual({
      phase: "lobby",
      scores: { p1: 0 },
    });

    player.sendInput(controlsAt(0.5, 1, true));
    host.publish("game", { phase: "playing", scores: { p1: 0 } });
    await clock.advance(20);
    expect(inputs).toEqual([{ seat: "p1", state: controlsAt(0.5, 1, true) }]);
    expect(player.channel("game")).toEqual({
      phase: "playing",
      scores: { p1: 0 },
    });

    const outcome = player.request("game", "ready", 7);
    await clock.advance();
    await expect(outcome).resolves.toEqual({
      status: "answered",
      result: { echoed: 7 },
    });
  });

  it("sends state as patches after a document and gives a reloading host its copies back", async () => {
    const { clock, network, common, host } = await openRoom();
    const hostLink = network.links[0];
    const padding = "x".repeat(200);
    host.publish("game", { round: 1, padding }, { fingerprint: "v1" });
    await clock.advance();
    host.publish("game", { round: 2, padding }, { fingerprint: "v1" });
    await clock.advance(20);
    expect(
      parsedText(hostLink?.sent ?? []).filter(
        (frame) => frame.type === "state",
      ),
    ).toEqual([
      {
        type: "state",
        channel: "game",
        revision: 1,
        document: { round: 1, padding },
        fingerprint: "v1",
      },
      {
        type: "state",
        channel: "game",
        revision: 2,
        base: 1,
        set: [[["round"], 2]],
        unset: [],
      },
    ]);

    host.close();
    const reloaded = new HostRoomSession({
      ...common,
      key: HOST_KEY,
      seats: 4,
      code: host.code,
      instance: host.instance,
    });
    await clock.advance();
    expect(reloaded.code).toBe(host.code);
    expect(reloaded.roomCopies).toEqual([
      {
        channel: "game",
        revision: 2,
        document: { round: 2, padding },
        fingerprint: "v1",
      },
    ]);
  });

  it("resumes a dropped phone in its seat and stops a replaced one for good", async () => {
    const { clock, network, host, join } = await openRoom();
    const player = join();
    await clock.advance();
    network.links.at(-1)?.break();
    await clock.advance();
    expect(player.status).toEqual({ phase: "reconnecting", attempt: 1 });
    expect(host.seats[0]?.connected).toBe(false);

    await clock.advance(250);
    expect(player.status).toEqual({ phase: "open" });
    expect(player.seat).toBe("p1");
    expect(host.seats[0]?.connected).toBe(true);

    const secondTab = join(PHONE_KEY, { instance: player.instance });
    await clock.advance(10_000);
    expect(player.status).toEqual({ phase: "closed", reason: "replaced" });
    expect(secondTab.seat).toBe("p1");
    expect(host.seats.map((seat) => [seat.id, seat.connected])).toEqual([
      ["p1", true],
    ]);
  });

  it("settles requests the host cannot answer as unconfirmed, busy or refused", async () => {
    const { clock, network, host, join } = await openRoom();
    const player = join();
    await clock.advance();

    const leased = player.request("control", "lease", 1, { exclusive: true });
    await expect(
      player.request("control", "lease", 2, { exclusive: true }),
    ).resolves.toEqual({ status: "busy" });
    await clock.advance();
    network.links.at(-1)?.break();
    await expect(leased).resolves.toEqual({ status: "unconfirmed" });

    await clock.advance(250);
    const slow = player.request("game", "ready", 1, { timeoutMs: 1_000 });
    await clock.advance(1_000);
    await expect(slow).resolves.toEqual({ status: "unconfirmed" });

    host.close();
    await clock.advance();
    const away = player.request("game", "ready");
    await clock.advance();
    await expect(away).resolves.toEqual({
      status: "refused",
      reason: "host-away",
    });
  });

  it("sends button edges at once and stick movement once per interval, ignoring tremor", async () => {
    const { clock, network, join } = await openRoom();
    const player = join();
    await clock.advance();
    const inputFrames = () =>
      (network.links.at(-1)?.sent ?? []).filter(
        (data): data is Uint8Array => typeof data !== "string",
      );

    player.sendInput(controlsAt(0.5));
    player.sendInput(controlsAt(0.6));
    await clock.advance();
    expect(inputFrames()).toHaveLength(1);

    player.sendInput(controlsAt(0.7, 1, true));
    await clock.advance(9);
    expect(inputFrames()).toHaveLength(2);

    player.sendInput(controlsAt(0.71, 1, true));
    await clock.advance(16);
    expect(inputFrames()).toHaveLength(2);

    player.sendInput(controlsAt(1, 1, true));
    await clock.advance();
    expect(inputFrames().at(-1)).toEqual(
      encodePhoneInputFrame(
        encodeInputPayload(controls, controlsAt(1, 1, true)),
      ),
    );
    expect(inputFrames()).toHaveLength(3);
  });

  it("spaces stick movement by the room's input rate when it is slower than the interval", () => {
    const lane = new PhoneInputLane(controls);
    lane.update(controlsAt(0));
    lane.take(0);
    lane.update(controlsAt(0.5));
    expect(lane.due(16, 100)).toBe(100);
  });

  it("does not take back a channel dropped while the host's link was down", async () => {
    const { clock, network, rooms, host } = await openRoom();
    host.publish("old", { round: 1 });
    await clock.advance(20);
    network.links[0]?.break();
    await clock.advance();
    host.drop("old");
    await clock.advance(250);
    expect(host.status).toEqual({ phase: "open" });
    for (let index = 0; index < DEFAULT_ROOM_LIMITS.channels; index += 1)
      host.publish(`c${index}`, {});
    await clock.advance(1_000);
    expect(rooms.describe()[0]?.channels).toHaveLength(
      DEFAULT_ROOM_LIMITS.channels,
    );
  });

  it("holds input behind a stalled link and sends only the latest once it drains", async () => {
    const { clock, network, join } = await openRoom();
    const player = join();
    await clock.advance();
    const link = network.links.at(-1);
    if (!link) throw new Error("The phone has no link.");
    const inputFrames = () =>
      link.sent.filter((data): data is Uint8Array => typeof data !== "string");

    link.stalled = true;
    for (let presses = 1; presses <= 5; presses += 1) {
      player.sendInput(controlsAt(0, presses, presses % 2 === 1));
      await clock.advance(50);
    }
    expect(inputFrames()).toHaveLength(0);

    link.stalled = false;
    await clock.advance(16);
    expect(inputFrames()).toEqual([
      encodePhoneInputFrame(
        encodeInputPayload(controls, controlsAt(0, 5, true)),
      ),
    ]);
  });

  it("replaces a link that stops answering, and reconnects at once when the device wakes", async () => {
    const { clock, network, join } = await openRoom();
    let wake = () => {};
    const player = join(PHONE_KEY, {
      deviceWakeEvents: (callback) => {
        wake = callback;
        return () => {};
      },
    });
    await clock.advance();
    network.links.at(-1)?.mute();
    await clock.advance(30_000);
    expect(player.status).toEqual({ phase: "reconnecting", attempt: 1 });

    wake();
    await clock.advance();
    expect(player.status).toEqual({ phase: "open" });
    expect(player.seat).toBe("p1");
  });

  it("carries a frame's session over a MessagePort through the page that serves it", async () => {
    const { clock, rooms, host } = await openRoom();
    const channel = new MessageChannel();
    const stopServing = serveRoomPort(
      channel.port1,
      createLoopbackConnector(rooms),
    );
    const player = new PhoneRoomSession({
      connector: createPortConnector(channel.port2),
      clock,
      deviceWakeEvents: null,
      key: PHONE_KEY,
      code: host.code ?? "",
    });
    for (let turn = 0; turn < 20 && player.status.phase !== "open"; turn += 1)
      await settle();
    expect(player.seat).toBe("p1");
    expect(host.seats.map((seat) => seat.id)).toEqual(["p1"]);
    stopServing();
    channel.port1.close();
  });
});
