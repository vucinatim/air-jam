import {
  decodeHostInputFrame,
  type RoomAddress,
  type RoomWireData,
} from "@air-jam/sdk/room-protocol";
import { describe, expect, it } from "vitest";
import {
  HELLO_DEADLINE_MS,
  MemoryRoomHost,
} from "../src/room-host/memory-room-host.js";
import { createOpenRoomGate, type RoomGate } from "../src/room/gate.js";
import { ManualClock, settle } from "./helpers/room-session-harness.js";

const hostHello = JSON.stringify({
  type: "hello",
  key: "host-key-00000001",
  sdk: "test",
  seats: 4,
});
const phoneHello = (key: string) =>
  JSON.stringify({ type: "hello", key, sdk: "test", kind: "phone" });

const connectTo = (rooms: MemoryRoomHost, address: RoomAddress) => {
  const sent: RoomWireData[] = [];
  const closeCodes: number[] = [];
  const handlers = rooms.accept(address, null, {
    send: (data) => sent.push(data),
    close: (code) => closeCodes.push(code),
  });
  const text = () =>
    sent.flatMap((data) =>
      typeof data === "string"
        ? [JSON.parse(data) as { type: string; code?: string }]
        : [],
    );
  return { sent, closeCodes, text, ...handlers };
};

const withRoom = async (gate: RoomGate = createOpenRoomGate()) => {
  const clock = new ManualClock();
  const rooms = new MemoryRoomHost({ gate, clock, codesMayBeAsked: true });
  const host = connectTo(rooms, { role: "host", code: "GAME" });
  host.receive(hostHello);
  await clock.advance();
  return { clock, rooms, host };
};

describe("memory room host", () => {
  it("opens the code a host asks for and refuses rooms that do not exist", async () => {
    const { rooms, host } = await withRoom();
    expect(host.text()[0]).toMatchObject({ type: "welcome", code: "GAME" });

    const lost = connectTo(rooms, { role: "phone", code: "NOPE" });
    lost.receive(phoneHello("phone-key-0000001"));
    const resumed = connectTo(rooms, { role: "host", code: "GONE" });
    resumed.receive(
      JSON.stringify({ ...JSON.parse(hostHello), instance: "old-room" }),
    );
    expect([lost.closeCodes, resumed.closeCodes]).toEqual([[4004], [4004]]);
  });

  it("packs input that is ready in one turn into one host message, keeping order", async () => {
    const { rooms, host } = await withRoom();
    const first = connectTo(rooms, { role: "phone", code: "GAME" });
    const second = connectTo(rooms, { role: "phone", code: "GAME" });
    first.receive(phoneHello("phone-key-0000001"));
    second.receive(phoneHello("phone-key-0000002"));
    host.sent.length = 0;

    first.receive(new Uint8Array([1, 10]));
    second.receive(new Uint8Array([1, 20]));
    first.receive(
      JSON.stringify({ type: "request", id: 1, channel: "game", name: "go" }),
    );
    await settle();

    expect(host.sent).toHaveLength(2);
    const [input, request] = host.sent;
    expect(input instanceof Uint8Array && decodeHostInputFrame(input)).toEqual([
      { seat: "p1", payload: new Uint8Array([10]) },
      { seat: "p2", payload: new Uint8Array([20]) },
    ]);
    expect(typeof request === "string" && JSON.parse(request)).toMatchObject({
      type: "request",
      seat: "p1",
    });
  });

  it("tells a queued host its place and opens its room when the gate admits it", async () => {
    let asked = 0;
    const { clock, host } = await withRoom({
      admit: () => {
        asked += 1;
        return asked === 1
          ? { outcome: "wait", position: 3 }
          : createOpenRoomGate().admit({
              hello: JSON.parse(hostHello),
              origin: null,
            });
      },
    });
    expect(host.text()).toEqual([{ type: "wait", position: 3 }]);
    await clock.advance(2_000);
    expect(host.text()[1]).toMatchObject({ type: "welcome", code: "GAME" });
  });

  it("closes a room on its own timer when the host stays away past its grace", async () => {
    const { clock, rooms, host } = await withRoom();
    const phone = connectTo(rooms, { role: "phone", code: "GAME" });
    phone.receive(phoneHello("phone-key-0000001"));
    host.closed();
    await clock.advance(59_999);
    expect(phone.closeCodes).toEqual([]);
    await clock.advance(1);
    expect(phone.closeCodes).toEqual([4003]);
    expect(rooms.describe()).toEqual([]);
  });

  it("closes a connection that never says hello", async () => {
    const { clock, rooms, host } = await withRoom();
    const silent = connectTo(rooms, { role: "phone", code: "GAME" });
    await clock.advance(HELLO_DEADLINE_MS);
    expect([silent.closeCodes, host.closeCodes]).toEqual([[4101], []]);
  });

  it("stops every room as restarting and admits nothing after", async () => {
    const { rooms, host } = await withRoom();
    const waiting = connectTo(rooms, { role: "host", code: null });
    rooms.stop();
    const late = connectTo(rooms, { role: "phone", code: "GAME" });
    expect([host.closeCodes, waiting.closeCodes, late.closeCodes]).toEqual([
      [4100],
      [4100],
      [4100],
    ]);
  });
});
