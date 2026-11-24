import {
  DEFAULT_ROOM_LIMITS,
  type RoomLimits,
} from "@air-jam/sdk/room-protocol";
import { describe, expect, it } from "vitest";
import {
  createMasterKeyRoomGate,
  createOpenRoomGate,
} from "../src/room/gate.js";
import { Room, type RoomEffect, type RoomSetup } from "../src/room/room.js";
import type { SavedRoom, SavedRoomChanges } from "../src/room/saved-room.js";

const HOST_KEY = "host-key-00000001";
const key = (seatNumber: number) =>
  `phone-key-${String(seatNumber).padStart(8, "0")}`;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const INPUT = new Uint8Array([1, 50, 156, 130, 0]);

const hostHello = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "hello",
    key: HOST_KEY,
    sdk: "test",
    seats: 16,
    ...fields,
  });
const phoneHello = (phoneKey: string, fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "hello",
    key: phoneKey,
    sdk: "test",
    kind: "phone",
    ...fields,
  });
const frame = (value: Record<string, unknown>) => JSON.stringify(value);

const open = (
  setup: Partial<RoomSetup> = {},
  limits: Partial<RoomLimits> = {},
) =>
  Room.open(
    {
      code: "ABCD",
      instance: "r1",
      hostKey: HOST_KEY,
      limits: { ...DEFAULT_ROOM_LIMITS, ...limits },
      labels: { app: "demo" },
      activity: null,
      activityChangeable: true,
      ...setup,
    },
    0,
  ).room;

/** An open room with its host on "host" and phones p1…pN on "c1"…"cN". */
const ready = (
  phones = 0,
  limits: Partial<RoomLimits> = {},
  setup: Partial<RoomSetup> = {},
) => {
  const room = open(setup, limits);
  room.connect("host", "host", hostHello(), 0);
  for (let seatNumber = 1; seatNumber <= phones; seatNumber += 1)
    room.connect(`c${seatNumber}`, "phone", phoneHello(key(seatNumber)), 0);
  return room;
};

type Frame = Record<string, unknown> & { type: string };
const sent = (effects: RoomEffect[], connection: string): Frame[] =>
  effects.flatMap((effect) =>
    "send" in effect &&
    effect.send === connection &&
    typeof effect.data === "string"
      ? [JSON.parse(effect.data) as Frame]
      : [],
  );
const binary = (effects: RoomEffect[], connection: string) =>
  effects.flatMap((effect) =>
    "send" in effect &&
    effect.send === connection &&
    effect.data instanceof Uint8Array
      ? [Array.from(effect.data)]
      : [],
  );
const closes = (effects: RoomEffect[]) =>
  Object.fromEntries(
    effects.flatMap((effect) =>
      "close" in effect ? [[effect.close, effect.reason]] : [],
    ),
  );
const facts = (effects: RoomEffect[]) =>
  effects.flatMap((effect) => ("fact" in effect ? [effect.fact] : []));

const document = (
  revision: number,
  value: Record<string, unknown>,
  extra = {},
) =>
  frame({
    type: "state",
    channel: "game",
    revision,
    document: value,
    ...extra,
  });
const patch = (
  revision: number,
  base: number,
  set: unknown[],
  unset: unknown[] = [],
) => frame({ type: "state", channel: "game", revision, base, set, unset });

describe("room core", () => {
  describe("seats", () => {
    it("gives a joining phone the next seat id, a free colour and its profile", () => {
      const room = ready(1);
      const effects = room.connect(
        "c2",
        "phone",
        phoneHello(key(2), { profile: { label: "Ana", avatarId: "fox" } }),
        0,
      );
      const [welcome] = sent(effects, "c2");
      expect(welcome).toMatchObject({
        type: "welcome",
        seat: "p2",
        host: true,
      });
      expect(welcome?.seats).toEqual([
        expect.objectContaining({
          id: "p1",
          label: "Player 1",
          color: "#38bdf8",
        }),
        expect.objectContaining({
          id: "p2",
          label: "Ana",
          avatarId: "fox",
          color: "#a78bfa",
        }),
      ]);
      expect(sent(effects, "host")).toEqual([
        {
          type: "seat",
          seat: expect.objectContaining({ id: "p2", connected: true }),
        },
      ]);
      expect(sent(effects, "c1")).toHaveLength(1);
      expect(facts(effects)).toEqual([
        expect.objectContaining({
          kind: "seat-joined",
          seat: "p2",
          resumed: false,
          labels: { app: "demo" },
        }),
      ]);
    });

    it("never reuses a seat id but does reuse a freed colour", () => {
      const room = ready(2);
      room.receive("c1", frame({ type: "leave" }), 0);
      const [welcome] = sent(
        room.connect("c3", "phone", phoneHello(key(3)), 0),
        "c3",
      );
      expect(welcome?.seat).toBe("p3");
      expect(welcome?.seats).toContainEqual(
        expect.objectContaining({ id: "p3", color: "#38bdf8" }),
      );
    });

    it("answers a repeated join with the same seat, so a lost welcome creates no ghost", () => {
      const room = ready(1);
      const effects = room.connect("c1-again", "phone", phoneHello(key(1)), 0);
      expect(sent(effects, "c1-again")[0]).toMatchObject({ seat: "p1" });
      expect(room.describe().seats).toHaveLength(1);
    });

    it("refuses joins beyond the seats the host wants, counting held seats", () => {
      const room = open();
      room.connect("host", "host", hostHello({ seats: 2 }), 0);
      room.connect("c1", "phone", phoneHello(key(1)), 0);
      room.connect("c2", "phone", phoneHello(key(2)), 0);
      room.disconnect("c2", 0);
      expect(
        closes(room.connect("c3", "phone", phoneHello(key(3)), 0)),
      ).toEqual({ c3: "full" });
    });

    it("never gives more seats than the limits allow", () => {
      const room = open({}, { seats: 1 });
      room.connect("host", "host", hostHello({ seats: 8 }), 0);
      room.connect("c1", "phone", phoneHello(key(1)), 0);
      expect(
        closes(room.connect("c2", "phone", phoneHello(key(2)), 0)),
      ).toEqual({ c2: "full" });
    });

    it("admits no new players while locked but lets seated ones return", () => {
      const room = ready(1);
      room.receive("host", frame({ type: "room", locked: true }), 0);
      room.disconnect("c1", 0);
      expect(
        closes(room.connect("c2", "phone", phoneHello(key(2)), 0)),
      ).toEqual({ c2: "full" });
      const effects = room.connect(
        "c1b",
        "phone",
        phoneHello(key(1), { instance: "r1" }),
        SECOND,
      );
      expect(sent(effects, "c1b")[0]).toMatchObject({ seat: "p1" });
    });

    it("never makes a seat on a resume, so a reused code is not walked into", () => {
      const room = ready(0);
      expect(
        closes(
          room.connect(
            "c1",
            "phone",
            phoneHello(key(1), { instance: "r1" }),
            0,
          ),
        ),
      ).toEqual({ c1: "not-found" });
      expect(
        closes(
          room.connect(
            "c2",
            "phone",
            phoneHello(key(2), { instance: "old-room" }),
            0,
          ),
        ),
      ).toEqual({ c2: "not-found" });
    });

    it("shows a local seat label over the player's own, and keeps renames underneath", () => {
      const room = ready(0);
      room.connect(
        "c1",
        "phone",
        phoneHello(key(1), {
          profile: { label: "Ana", localSeatLabel: "Left pad" },
        }),
        0,
      );
      const effects = room.receive(
        "c1",
        frame({ type: "profile", label: "Ana B", avatarId: "owl" }),
        0,
      );
      expect(sent(effects, "host")).toEqual([
        {
          type: "seat",
          seat: expect.objectContaining({ label: "Left pad", avatarId: "owl" }),
        },
      ]);
      expect(sent(effects, "c1")).toHaveLength(1);
      room.disconnect("c1", 0);
      const [welcome] = sent(
        room.connect("c1b", "phone", phoneHello(key(1)), 0),
        "c1b",
      );
      expect(welcome?.seats).toEqual([
        expect.objectContaining({ label: "Ana B" }),
      ]);
    });

    it("frees a seat the phone gives up and tells it not to come back", () => {
      const room = ready(2);
      const effects = room.receive("c1", frame({ type: "leave" }), 0);
      expect(closes(effects)).toEqual({ c1: "left" });
      expect(sent(effects, "host")).toEqual([{ type: "left", seat: "p1" }]);
      expect(sent(effects, "c2")).toEqual([{ type: "left", seat: "p1" }]);
      expect(facts(effects)).toEqual([
        expect.objectContaining({ kind: "seat-left", cause: "left" }),
      ]);
    });

    it("lets the host remove a seat, closing its phone for good", () => {
      const room = ready(1);
      const effects = room.receive(
        "host",
        frame({ type: "remove", seat: "p1" }),
        0,
      );
      expect(closes(effects)).toEqual({ c1: "removed" });
      expect(facts(effects)).toEqual([
        expect.objectContaining({ kind: "seat-left", cause: "removed" }),
      ]);
      expect(room.disconnect("c1", 0)).toEqual([]);
    });
  });

  describe("resume", () => {
    it("hands a live seat to a new connection with the key and closes the old one as replaced", () => {
      const room = ready(1);
      const effects = room.connect(
        "c1-cellular",
        "phone",
        phoneHello(key(1), { instance: "r1" }),
        5 * SECOND,
      );
      expect(closes(effects)).toEqual({ c1: "replaced" });
      expect(sent(effects, "c1-cellular")[0]).toMatchObject({ seat: "p1" });
      expect(facts(effects)).toEqual([]);
      // The dead Wi-Fi connection's late frames and its close change nothing.
      expect(room.receive("c1", INPUT, 6 * SECOND)).toEqual([]);
      expect(room.disconnect("c1", 50 * SECOND)).toEqual([]);
      expect(room.describe().seats[0]).toMatchObject({ connected: true });
    });

    it("returns a held seat to a phone that was locked for seventy seconds", () => {
      const room = ready(1);
      room.disconnect("c1", 50 * SECOND);
      const effects = room.connect(
        "c1b",
        "phone",
        phoneHello(key(1), { instance: "r1" }),
        70 * SECOND,
      );
      expect(sent(effects, "c1b")[0]).toMatchObject({ seat: "p1" });
      expect(sent(effects, "host")).toEqual([
        {
          type: "seat",
          seat: expect.objectContaining({ id: "p1", connected: true }),
        },
      ]);
      expect(facts(effects)).toEqual([
        expect.objectContaining({ kind: "seat-joined", resumed: true }),
      ]);
    });
  });

  describe("seat hold", () => {
    it("shows a dropped phone as disconnected, then frees its seat after two minutes", () => {
      const room = ready(2);
      const dropped = room.disconnect("c1", 10 * SECOND);
      expect(sent(dropped, "host")).toEqual([
        {
          type: "seat",
          seat: expect.objectContaining({ id: "p1", connected: false }),
        },
      ]);
      expect(facts(dropped)).toEqual([
        expect.objectContaining({ kind: "seat-dropped" }),
      ]);
      expect(room.nextWake()).toBe(10 * SECOND + 2 * MINUTE);
      expect(room.wake(10 * SECOND + 2 * MINUTE - 1)).toEqual([]);
      const freed = room.wake(10 * SECOND + 2 * MINUTE);
      expect(sent(freed, "host")).toEqual([{ type: "left", seat: "p1" }]);
      expect(sent(freed, "c2")).toEqual([{ type: "left", seat: "p1" }]);
      expect(facts(freed)).toEqual([
        expect.objectContaining({ kind: "seat-left", cause: "dropped" }),
      ]);
    });

    it("frees an agent's seat as soon as it drops", () => {
      const room = ready(0);
      room.connect("agent", "phone", phoneHello(key(1), { kind: "agent" }), 0);
      const effects = room.disconnect("agent", 0);
      expect(sent(effects, "host")).toEqual([{ type: "left", seat: "p1" }]);
      expect(room.nextWake()).toBe(DEFAULT_ROOM_LIMITS.maximumAgeMs);
    });

    it("refuses a return after the hold even when no wake ran in between", () => {
      const room = ready(1);
      room.disconnect("c1", 0);
      const effects = room.connect(
        "c1b",
        "phone",
        phoneHello(key(1), { instance: "r1" }),
        3 * MINUTE,
      );
      expect(sent(effects, "host")).toEqual([{ type: "left", seat: "p1" }]);
      expect(closes(effects)).toEqual({ c1b: "not-found" });
    });
  });

  describe("host grace", () => {
    it("keeps the room while a reloading host returns, telling phones the screen was away", () => {
      const room = ready(1);
      const away = room.disconnect("host", 10 * SECOND);
      expect(sent(away, "c1")).toEqual([{ type: "host", present: false }]);
      const [welcome] = sent(
        room.connect("c2", "phone", phoneHello(key(2)), 12 * SECOND),
        "c2",
      );
      expect(welcome).toMatchObject({ host: false });
      const back = room.connect(
        "host2",
        "host",
        hostHello({ instance: "r1" }),
        15 * SECOND,
      );
      expect(sent(back, "host2")[0]).toMatchObject({
        type: "welcome",
        instance: "r1",
        seats: [
          expect.objectContaining({ id: "p1" }),
          expect.objectContaining({ id: "p2" }),
        ],
      });
      expect(sent(back, "c1")).toEqual([{ type: "host", present: true }]);
    });

    it("closes the room sixty seconds after its host left", () => {
      const room = ready(1);
      room.disconnect("host", 0);
      expect(room.nextWake()).toBe(MINUTE);
      const effects = room.wake(MINUTE);
      expect(closes(effects)).toEqual({ c1: "closed" });
      expect(facts(effects)).toEqual([
        expect.objectContaining({
          kind: "closed",
          cause: "host-gone",
          at: MINUTE,
        }),
      ]);
      expect(room.nextWake()).toBeNull();
    });

    it("closes a room whose host never arrived", () => {
      const room = open();
      expect(facts(room.wake(MINUTE))).toEqual([
        expect.objectContaining({ kind: "closed", cause: "host-gone" }),
      ]);
    });

    it("lets only the host's own key reclaim the room, and only this instance", () => {
      const room = ready(0);
      room.disconnect("host", 0);
      expect(
        closes(
          room.connect(
            "thief",
            "host",
            hostHello({ key: "someone-elses-key" }),
            0,
          ),
        ),
      ).toEqual({ thief: "unauthorised" });
      expect(
        closes(room.connect("stale", "host", hostHello({ instance: "r0" }), 0)),
      ).toEqual({ stale: "not-found" });
    });

    it("hands the host role to a newer connection with the key", () => {
      const room = ready(0);
      expect(
        closes(room.connect("host2", "host", hostHello({ instance: "r1" }), 0)),
      ).toEqual({ host: "replaced" });
      expect(room.describe().host).toEqual({
        connected: true,
        awayUntil: null,
      });
    });
  });

  describe("input", () => {
    it("forwards a phone's bytes to the host stamped with its seat, without reading them", () => {
      const room = ready(2);
      expect(binary(room.receive("c2", INPUT, 0), "host")).toEqual([
        [1, 0, 2, 4, 50, 156, 130, 0],
      ]);
    });

    it("drops input while the host is away and never stores it", () => {
      const room = ready(1);
      room.disconnect("host", 0);
      expect(room.receive("c1", INPUT, 0)).toEqual([]);
      expect(
        binary(room.connect("host2", "host", hostHello(), SECOND), "host2"),
      ).toEqual([]);
    });

    it("drops input over the rate until the next second", () => {
      const room = ready(1, { inputsPerSecond: 2 });
      const forwarded = [0, 1, 2].flatMap((tick) =>
        binary(room.receive("c1", INPUT, tick), "host"),
      );
      expect(forwarded).toHaveLength(2);
      expect(binary(room.receive("c1", INPUT, SECOND), "host")).toHaveLength(1);
    });

    it("ends a phone that sends more control bytes than the limit", () => {
      const room = ready(1, { inputBytes: 3 });
      expect(closes(room.receive("c1", INPUT, 0))).toEqual({
        c1: "limits-broken",
      });
    });

    it("ignores binary kinds it does not know and binary from the host", () => {
      const room = ready(1);
      expect(room.receive("c1", new Uint8Array([9, 1, 2]), 0)).toEqual([]);
      expect(room.receive("host", INPUT, 0)).toEqual([]);
    });
  });

  describe("state", () => {
    it("keeps the host's document and relays it to phones, never back to the host", () => {
      const room = ready(1);
      const effects = room.receive("host", document(1, { phase: "lobby" }), 0);
      expect(sent(effects, "c1")).toEqual([
        {
          type: "state",
          channel: "game",
          revision: 1,
          document: { phase: "lobby" },
        },
      ]);
      expect(sent(effects, "host")).toEqual([]);
    });

    it("serves a joining phone the current copy without asking the host", () => {
      const room = ready(0);
      room.receive("host", document(1, { scores: { red: 0 } }), 0);
      room.receive("host", patch(2, 1, [[["scores", "red"], 1]]), 0);
      const effects = room.connect("c1", "phone", phoneHello(key(1)), 0);
      expect(sent(effects, "c1")[0]?.channels).toEqual([
        { channel: "game", revision: 2, document: { scores: { red: 1 } } },
      ]);
      expect(sent(effects, "host").map((sentFrame) => sentFrame.type)).toEqual([
        "seat",
      ]);
    });

    it("relays a patch that fits its copy with its revisions", () => {
      const room = ready(1);
      room.receive("host", document(1, { secondsLeft: 30 }), 0);
      const effects = room.receive(
        "host",
        patch(2, 1, [[["secondsLeft"], 29]]),
        0,
      );
      expect(sent(effects, "c1")).toEqual([
        {
          type: "state",
          channel: "game",
          revision: 2,
          base: 1,
          set: [[["secondsLeft"], 29]],
          unset: [],
        },
      ]);
    });

    it("asks the host once for the document when a patch misses, and heals from it", () => {
      const room = ready(1);
      room.receive("host", document(1, { secondsLeft: 30 }), 0);
      const missed = room.receive(
        "host",
        patch(3, 2, [[["secondsLeft"], 28]]),
        0,
      );
      expect(sent(missed, "host")).toEqual([{ type: "need", channel: "game" }]);
      expect(sent(missed, "c1")).toEqual([]);
      expect(
        room.receive("host", patch(4, 3, [[["secondsLeft"], 27]]), 0),
      ).toEqual([]);
      const healed = room.receive("host", document(4, { secondsLeft: 27 }), 0);
      expect(sent(healed, "c1")).toEqual([
        {
          type: "state",
          channel: "game",
          revision: 4,
          document: { secondsLeft: 27 },
        },
      ]);
    });

    it("asks for the document when a patch does not fit the copy", () => {
      const room = ready(0);
      room.receive("host", document(1, { list: [1] }), 0);
      expect(
        sent(
          room.receive("host", patch(2, 1, [[["list", "0"], 2]]), 0),
          "host",
        ),
      ).toEqual([{ type: "need", channel: "game" }]);
      expect(sent(room.receive("host", patch(1, 0, []), 0), "host")).toEqual(
        [],
      );
    });

    it("shows each phone only its own private entry, keeping every phone's revisions whole", () => {
      const room = ready(2);
      const hands = { phase: "deal", hands: { p1: [1], p2: [2] } };
      const dealt = room.receive(
        "host",
        document(1, hands, { private: "hands", fingerprint: "f1" }),
        0,
      );
      expect(sent(dealt, "c1")[0]?.document).toEqual({
        phase: "deal",
        hands: { p1: [1] },
      });
      expect(sent(dealt, "c2")[0]?.document).toEqual({
        phase: "deal",
        hands: { p2: [2] },
      });
      const drawn = room.receive(
        "host",
        patch(2, 1, [
          [
            ["hands", "p1"],
            [1, 5],
          ],
        ]),
        0,
      );
      expect(sent(drawn, "c1")[0]).toMatchObject({
        revision: 2,
        base: 1,
        set: [
          [
            ["hands", "p1"],
            [1, 5],
          ],
        ],
      });
      expect(sent(drawn, "c2")[0]).toMatchObject({
        revision: 2,
        base: 1,
        set: [],
      });
      const redealt = room.receive(
        "host",
        patch(3, 2, [[["hands"], { p1: [7], p2: [8] }]]),
        0,
      );
      expect(sent(redealt, "c2")[0]).toMatchObject({
        set: [[["hands"], { p2: [8] }]],
      });
      const [welcome] = sent(
        room.connect("c2b", "phone", phoneHello(key(2)), 0),
        "c2b",
      );
      expect(welcome?.channels).toEqual([
        {
          channel: "game",
          revision: 3,
          document: { phase: "deal", hands: { p2: [8] } },
        },
      ]);
    });

    it("gives a reloading host every copy whole, with its shape fingerprint", () => {
      const room = ready(1);
      room.receive(
        "host",
        document(
          1,
          { hands: { p1: [1] } },
          { private: "hands", fingerprint: "f1" },
        ),
        0,
      );
      room.disconnect("host", 0);
      const [welcome] = sent(
        room.connect("host2", "host", hostHello({ instance: "r1" }), SECOND),
        "host2",
      );
      expect(welcome?.channels).toEqual([
        {
          channel: "game",
          revision: 1,
          document: { hands: { p1: [1] } },
          fingerprint: "f1",
          private: "hands",
        },
      ]);
    });

    it("ends a host whose document would outgrow its limit", () => {
      const room = ready(0, { stateBytes: 120 });
      room.receive("host", document(1, {}), 0);
      // Each entry weighs 36 bytes, so the fourth takes the copy past 120.
      const grow = (revision: number) =>
        room.receive(
          "host",
          patch(revision + 1, revision, [[[`a${revision}`], "x".repeat(30)]]),
          0,
        );
      expect(
        [1, 2, 3].flatMap((revision) => Object.values(closes(grow(revision)))),
      ).toEqual([]);
      expect(closes(grow(4))).toEqual({ host: "limits-broken" });
    });

    it("ends a host that opens more channels than the limit", () => {
      const room = ready(0, { channels: 1 });
      room.receive("host", document(1, {}), 0);
      const effects = room.receive(
        "host",
        frame({ type: "state", channel: "other", revision: 1, document: {} }),
        0,
      );
      expect(closes(effects)).toEqual({ host: "limits-broken" });
    });

    it("discards a dropped channel for phones and later joiners", () => {
      const room = ready(1);
      room.receive("host", document(1, {}), 0);
      expect(
        sent(
          room.receive("host", frame({ type: "drop", channel: "game" }), 0),
          "c1",
        ),
      ).toEqual([{ type: "drop", channel: "game" }]);
      expect(
        sent(room.connect("c2", "phone", phoneHello(key(2)), 0), "c2")[0]
          ?.channels,
      ).toEqual([]);
    });
  });

  describe("requests", () => {
    it("sends a phone's request to the host with its seat, and the answer back to that phone only", () => {
      const room = ready(2);
      const request = frame({
        type: "request",
        id: 7,
        channel: "game",
        name: "ready",
        payload: { team: "red" },
      });
      expect(sent(room.receive("c2", request, 0), "host")).toEqual([
        {
          type: "request",
          seat: "p2",
          id: 7,
          channel: "game",
          name: "ready",
          payload: { team: "red" },
        },
      ]);
      const answer = room.receive(
        "host",
        frame({ type: "response", seat: "p2", id: 7, result: { ok: true } }),
        0,
      );
      expect(sent(answer, "c2")).toEqual([
        { type: "response", id: 7, result: { ok: true } },
      ]);
      expect(sent(answer, "c1")).toEqual([]);
    });

    it("answers for the host while it is away", () => {
      const room = ready(1);
      room.disconnect("host", 0);
      const effects = room.receive(
        "c1",
        frame({ type: "request", id: 3, channel: "game", name: "ready" }),
        0,
      );
      expect(sent(effects, "c1")).toEqual([
        { type: "response", id: 3, refused: "host-away" },
      ]);
    });

    it("drops an answer for a seat that is no longer connected", () => {
      const room = ready(1);
      room.disconnect("c1", 0);
      expect(
        room.receive(
          "host",
          frame({ type: "response", seat: "p1", id: 1, result: null }),
          0,
        ),
      ).toEqual([]);
    });
  });

  describe("signals", () => {
    it("delivers a signal to one seat or to every phone, and never replays it", () => {
      const room = ready(2);
      const one = room.receive(
        "host",
        frame({
          type: "signal",
          seat: "p1",
          kind: "haptic",
          payload: { pattern: "light" },
        }),
        0,
      );
      expect(sent(one, "c1")).toEqual([
        { type: "signal", kind: "haptic", payload: { pattern: "light" } },
      ]);
      expect(sent(one, "c2")).toEqual([]);
      const all = room.receive(
        "host",
        frame({ type: "signal", kind: "toast", payload: { message: "Go" } }),
        0,
      );
      expect(sent(all, "c1")).toHaveLength(1);
      expect(sent(all, "c2")).toHaveLength(1);
      const [welcome] = sent(
        room.connect("c3", "phone", phoneHello(key(3)), 0),
        "c3",
      );
      expect(JSON.stringify(welcome)).not.toContain("toast");
    });
  });

  describe("limits", () => {
    it("ignores frame types from a newer peer without counting them", () => {
      const room = ready(1, { strikesPerSecond: 1 });
      for (let tick = 0; tick < 5; tick += 1)
        expect(room.receive("c1", frame({ type: "wave" }), tick)).toEqual([]);
    });

    it("ends a connection after too many malformed frames in one second", () => {
      const room = ready(1, { strikesPerSecond: 2 });
      expect(room.receive("c1", "not json", 0)).toEqual([]);
      expect(room.receive("c1", frame({ type: "request", id: -1 }), 1)).toEqual(
        [],
      );
      const effects = room.receive("c1", frame({ type: "profile" }), 2);
      expect(closes(effects)).toEqual({ c1: "limits-broken" });
      expect(sent(effects, "host")).toEqual([
        {
          type: "seat",
          seat: expect.objectContaining({ id: "p1", connected: false }),
        },
      ]);
      expect(room.receive("c1", "[]", SECOND)).toEqual([]);
    });

    it("drops frames over the rate and lets the next second through", () => {
      const room = ready(1, { framesPerSecond: 1 });
      const request = (id: number) =>
        frame({ type: "request", id, channel: "game", name: "tap" });
      expect(sent(room.receive("c1", request(1), 0), "host")).toHaveLength(1);
      expect(sent(room.receive("c1", request(2), 1), "host")).toHaveLength(0);
      expect(sent(room.receive("c1", request(3), SECOND), "host")).toHaveLength(
        1,
      );
    });

    it("ends a connection whose frame is larger than its lane allows", () => {
      const room = ready(1, { frameBytes: 100 });
      const big = frame({
        type: "request",
        id: 1,
        channel: "game",
        name: "x".repeat(100),
      });
      expect(closes(room.receive("c1", big, 0))).toEqual({
        c1: "limits-broken",
      });
      expect(closes(room.connect("c2", "phone", big, 0))).toEqual({
        c2: "limits-broken",
      });
    });

    it("refuses a hello it cannot read as an unsupported protocol", () => {
      const room = ready(0);
      expect(
        closes(room.connect("c1", "phone", frame({ type: "hello" }), 0)),
      ).toEqual({ c1: "unsupported-version" });
      const { seats: _seats, ...withoutSeats } = JSON.parse(hostHello());
      expect(
        closes(room.connect("h2", "host", JSON.stringify(withoutSeats), 0)),
      ).toEqual({ h2: "unsupported-version" });
    });

    it("admits no player before the host says how many its game takes", () => {
      const room = open();
      expect(
        closes(room.connect("c1", "phone", phoneHello(key(1)), 0)),
      ).toEqual({ c1: "full" });
    });

    it("answers the heartbeat", () => {
      const room = ready(1);
      expect(room.receive("c1", "ping", 0)).toEqual([
        { send: "c1", data: "pong" },
      ]);
    });
  });

  describe("lifecycle", () => {
    it("closes everyone when the host ends the room", () => {
      const room = ready(2);
      const effects = room.receive("host", frame({ type: "end" }), 0);
      expect(closes(effects)).toEqual({
        host: "closed",
        c1: "closed",
        c2: "closed",
      });
      expect(facts(effects)).toEqual([
        expect.objectContaining({ kind: "closed", cause: "ended" }),
      ]);
    });

    it("stops for the operator as closed and for a shutdown as restarting", () => {
      expect(closes(ready(1).stop("operator", 0))).toEqual({
        host: "closed",
        c1: "closed",
      });
      expect(closes(ready(1).stop("restarting", 0))).toEqual({
        host: "restarting",
        c1: "restarting",
      });
    });

    it("closes at its maximum age even with everyone connected", () => {
      const room = ready(1, { maximumAgeMs: 10 * SECOND });
      expect(room.nextWake()).toBe(10 * SECOND);
      expect(facts(room.wake(10 * SECOND))).toEqual([
        expect.objectContaining({ kind: "closed", cause: "expired" }),
      ]);
    });

    it("stays open through an idle hour", () => {
      const room = ready(2);
      expect(room.wake(60 * MINUTE)).toEqual([]);
      expect(
        binary(room.receive("c1", INPUT, 60 * MINUTE), "host"),
      ).toHaveLength(1);
    });

    it("turns away connections once closed", () => {
      const room = ready(1);
      room.receive("host", frame({ type: "end" }), 0);
      expect(
        closes(room.connect("c2", "phone", phoneHello(key(2)), 0)),
      ).toEqual({ c2: "closed" });
      expect(room.receive("c1", INPUT, 0)).toEqual([]);
      expect(room.disconnect("c1", 0)).toEqual([]);
    });

    it("reports what is on screen when a launcher changes it, and refuses others", () => {
      const launcher = ready(0);
      const effects = launcher.receive(
        "host",
        frame({ type: "activity", activity: "air-capture" }),
        0,
      );
      expect(facts(effects)).toEqual([
        expect.objectContaining({ kind: "activity", activity: "air-capture" }),
      ]);
      expect(
        launcher.receive(
          "host",
          frame({ type: "activity", activity: "air-capture" }),
          0,
        ),
      ).toEqual([]);
      const game = ready(
        0,
        { strikesPerSecond: 1 },
        { activity: "pong", activityChangeable: false },
      );
      expect(
        game.receive("host", frame({ type: "activity", activity: null }), 0),
      ).toEqual([]);
      expect(game.describe().activity).toBe("pong");
    });

    it("reports its opening with the gate's labels", () => {
      const { effects } = Room.open(
        {
          code: "ABCD",
          instance: "r1",
          hostKey: HOST_KEY,
          limits: DEFAULT_ROOM_LIMITS,
          labels: { game: "pong" },
          activity: "pong",
          activityChangeable: false,
        },
        5,
      );
      expect(facts(effects)).toEqual([
        {
          at: 5,
          code: "ABCD",
          instance: "r1",
          labels: { game: "pong" },
          kind: "opened",
        },
      ]);
    });
  });

  describe("saving and restoring", () => {
    const merge = (
      saved: SavedRoom | null,
      changes: SavedRoomChanges,
    ): SavedRoom => {
      const record = changes.room ?? saved?.room;
      if (!record) throw new Error("The first save carries the room.");
      const present = <Value>(entries: Record<string, Value | null>) =>
        Object.fromEntries(
          Object.entries(entries).filter(
            (entry): entry is [string, Value] => entry[1] !== null,
          ),
        );
      return {
        schema: changes.schema,
        room: record,
        seats: present({ ...saved?.seats, ...changes.seats }),
        channels: present({ ...saved?.channels, ...changes.channels }),
      };
    };

    it("hands out only the slices that changed since the last save", () => {
      const room = ready(1);
      const first = room.save();
      expect(first?.room).toBeDefined();
      expect(Object.keys(first?.seats ?? {})).toEqual(["p1"]);
      expect(room.save()).toBeNull();
      room.receive("host", document(1, {}), 0);
      expect(room.save()).toEqual({
        schema: 1,
        seats: {},
        channels: { game: expect.objectContaining({ revision: 1 }) },
      });
      room.receive("c1", frame({ type: "leave" }), 0);
      expect(room.save()?.seats).toEqual({ p1: null });
    });

    it("comes back from saved state, treating connections that closed meanwhile as dropped", () => {
      const room = ready(2);
      room.receive("host", document(1, { phase: "play" }), 0);
      const saved = merge(
        null,
        room.save() ?? { schema: 1, seats: {}, channels: {} },
      );
      const { room: restored, effects } = Room.restore(
        saved,
        ["host", "c1"],
        10 * SECOND,
      );
      if (!restored) throw new Error("The room should come back.");
      expect(sent(effects, "host")).toEqual([
        {
          type: "seat",
          seat: expect.objectContaining({ id: "p2", connected: false }),
        },
      ]);
      expect(facts(effects)).toEqual([
        expect.objectContaining({ kind: "seat-dropped", seat: "p2" }),
      ]);
      expect(
        binary(restored.receive("c1", INPUT, 10 * SECOND), "host"),
      ).toHaveLength(1);
      const [welcome] = sent(
        restored.connect(
          "c2b",
          "phone",
          phoneHello(key(2), { instance: "r1" }),
          11 * SECOND,
        ),
        "c2b",
      );
      expect(welcome).toMatchObject({
        seat: "p2",
        channels: [expect.objectContaining({ document: { phase: "play" } })],
      });
    });

    it("starts the host's grace when the host's connection closed while the room slept", () => {
      const room = ready(1);
      const saved = merge(
        null,
        room.save() ?? { schema: 1, seats: {}, channels: {} },
      );
      const { room: restored, effects } = Room.restore(
        saved,
        ["c1"],
        5 * SECOND,
      );
      expect(sent(effects, "c1")).toEqual([{ type: "host", present: false }]);
      expect(restored?.nextWake()).toBe(5 * SECOND + MINUTE);
    });

    it("applies deadlines that passed while the room slept", () => {
      const room = ready(1);
      room.disconnect("c1", 0);
      const saved = merge(
        null,
        room.save() ?? { schema: 1, seats: {}, channels: {} },
      );
      const { effects } = Room.restore(saved, ["host"], 5 * MINUTE);
      expect(sent(effects, "host")).toEqual([{ type: "left", seat: "p1" }]);
    });

    it("cannot read state saved by a newer release and sends everyone to restart", () => {
      const room = ready(1);
      const saved = merge(
        null,
        room.save() ?? { schema: 1, seats: {}, channels: {} },
      );
      const { room: restored, effects } = Room.restore(
        { ...saved, schema: 2 },
        ["host", "c1"],
        0,
      );
      expect(restored).toBeNull();
      expect(closes(effects)).toEqual({ host: "restarting", c1: "restarting" });
    });
  });

  describe("gates", () => {
    const hello = (credential?: string) => ({
      type: "hello" as const,
      key: HOST_KEY,
      sdk: "test",
      seats: 8,
      credential,
    });

    it("opens to every host with the default limits", async () => {
      expect(
        await createOpenRoomGate().admit({ hello: hello(), origin: null }),
      ).toMatchObject({
        outcome: "open",
        limits: DEFAULT_ROOM_LIMITS,
        activityChangeable: true,
      });
    });

    it("opens only to the shared master key", async () => {
      const gate = createMasterKeyRoomGate("master-secret");
      expect(
        await gate.admit({ hello: hello("master-secret"), origin: null }),
      ).toMatchObject({ outcome: "open" });
      expect(
        await gate.admit({ hello: hello("master-secreT"), origin: null }),
      ).toEqual({ outcome: "refuse", reason: "unauthorised" });
      expect(await gate.admit({ hello: hello(), origin: null })).toEqual({
        outcome: "refuse",
        reason: "unauthorised",
      });
    });
  });
});
