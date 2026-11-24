import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AirJamInput, AirJamInputState } from "../src/core/input";
import {
  applyStatePatch,
  applyWeighedStatePatch,
  decodeHostInputFrame,
  decodeInputPayload,
  DEFAULT_ROOM_LIMITS,
  diffState,
  encodeFrame,
  encodeHostInputFrame,
  encodeInputPayload,
  encodePhoneInputFrame,
  isTerminalRoomClose,
  joinHostInputFrames,
  parseHostHello,
  parseHostToRoomFrame,
  parsePhoneHello,
  parsePhoneToRoomFrame,
  parseRoomPath,
  parseRoomToHostFrame,
  parseRoomToPhoneFrame,
  roomCloseCodes,
  roomLimitsSchema,
  roomPath,
  stateWeight,
} from "../src/room-protocol";

interface GoldenFrames {
  text: Array<{ name: string; direction: string; text: string }>;
  input: {
    controls: AirJamInput;
    state: AirJamInputState;
    phoneFrame: string;
    hostFrame: { seats: string[]; hex: string };
  };
  closeCodes: unknown;
}

const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/room-protocol-golden-frames.json", import.meta.url),
    "utf8",
  ),
) as GoldenFrames;

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");
const bytes = (text: string) => new Uint8Array(Buffer.from(text, "hex"));

const parse = (direction: string, text: string): unknown => {
  const hello = (JSON.parse(text) as { type: string }).type === "hello";
  if (direction === "host-to-room")
    return hello ? parseHostHello(text) : frameOf(parseHostToRoomFrame(text));
  if (direction === "phone-to-room")
    return hello ? parsePhoneHello(text) : frameOf(parsePhoneToRoomFrame(text));
  if (direction === "room-to-host") return frameOf(parseRoomToHostFrame(text));
  return frameOf(parseRoomToPhoneFrame(text));
};

const frameOf = (parsed: { status: string; frame?: unknown }) =>
  parsed.status === "frame" ? parsed.frame : null;

describe("room protocol", () => {
  it("parses every golden text frame and encodes it back exactly", () => {
    for (const { name, direction, text } of golden.text) {
      const frame = parse(direction, text);
      expect(frame, name).not.toBeNull();
      expect(
        encodeFrame(frame as Parameters<typeof encodeFrame>[0]),
        name,
      ).toBe(text);
    }
    expect(golden.closeCodes).toEqual(roomCloseCodes);
  });

  it("encodes the golden input frames and decodes them back", () => {
    const { controls, state, phoneFrame, hostFrame } = golden.input;
    const encoded = encodePhoneInputFrame(encodeInputPayload(controls, state));
    expect(hex(encoded)).toBe(phoneFrame);
    const joined = joinHostInputFrames(
      hostFrame.seats.map((seat) => encodeHostInputFrame(seat, encoded)),
    );
    expect(hex(joined)).toBe(hostFrame.hex);

    const records = decodeHostInputFrame(bytes(hostFrame.hex));
    expect(records.map((record) => record.seat)).toEqual(hostFrame.seats);
    // Seven bits of presses travel; the host unwraps them against what it held.
    const previous = { ...state, fire: { down: false, presses: 129 } };
    for (const record of records)
      expect(decodeInputPayload(controls, record.payload, previous)).toEqual(
        state,
      );
  });

  it("decodes nothing from bytes that do not fit the declared controls", () => {
    const { controls } = golden.input;
    expect(decodeInputPayload(controls, new Uint8Array(3), null)).toBeNull();
    expect(
      decodeInputPayload(controls, new Uint8Array([120, 0, 0, 0]), null),
    ).toBeNull();
    expect(() => decodeHostInputFrame(new Uint8Array([1, 0, 1, 9]))).toThrow();
  });

  it("patches turn one document into the next, keeping unchanged branches", () => {
    const untouched = { deep: { list: [1, 2] } };
    const previous = {
      phase: "lobby",
      scores: { red: 1, blue: 2 },
      ready: { p1: true, p3: true },
      untouched,
      bots: [1],
    };
    const next = {
      phase: "lobby",
      scores: { red: 1, blue: 3 },
      ready: { p1: true },
      untouched,
      bots: [1, 2],
      winner: null,
    };
    const patch = diffState(previous, next);
    expect(patch).toEqual({
      set: [
        [["scores", "blue"], 3],
        [["bots"], [1, 2]],
        [["winner"], null],
      ],
      unset: [["ready", "p3"]],
    });
    const applied = applyStatePatch(previous, patch);
    expect(applied).toEqual(next);
    expect(applied?.untouched).toBe(untouched);
    expect(previous.ready).toEqual({ p1: true, p3: true });
  });

  it("applies a whole frame in one pass and weighs it exactly", () => {
    const fields = Object.fromEntries(
      Array.from({ length: 3_000 }, (_, index) => [`f${index}`, index]),
    );
    const placed = { inner: 1 };
    const previous = { fields, kept: { a: 1 } };
    const patch = {
      set: [
        ...Object.keys(fields).map(
          (key) => [["fields", key], "changed"] as const,
        ),
        [["placed"], placed] as const,
        [["placed", "added"], 2] as const,
      ],
      unset: [["kept", "a"]],
    };
    const applied = applyWeighedStatePatch(
      previous,
      stateWeight(previous),
      patch,
    );
    expect(applied?.document.fields).toEqual(
      Object.fromEntries(Object.keys(fields).map((key) => [key, "changed"])),
    );
    expect(applied?.document.placed).toEqual({ inner: 1, added: 2 });
    expect(applied?.document.kept).toEqual({});
    expect(applied?.weight).toBe(stateWeight(applied?.document));
    expect([previous.fields.f0, previous.kept.a, placed]).toEqual([
      0,
      1,
      { inner: 1 },
    ]);
  });

  it("keeps configured limits strict, and a welcome's limits open to newer fields", () => {
    expect(
      roomLimitsSchema.safeParse({ ...DEFAULT_ROOM_LIMITS, newer: 1 }).success,
    ).toBe(false);
    expect(
      roomLimitsSchema.safeParse({ ...DEFAULT_ROOM_LIMITS, hostGraceMs: 0 })
        .success,
    ).toBe(false);
    const welcome = golden.text.find(
      (entry) =>
        entry.direction === "room-to-phone" &&
        JSON.parse(entry.text).type === "welcome",
    );
    if (!welcome) throw new Error("The golden frames hold a phone welcome.");
    const newer = JSON.parse(welcome.text);
    newer.limits.newer = 1;
    expect(parseRoomToPhoneFrame(JSON.stringify(newer)).status).toBe("frame");
  });

  it("refuses a patch that does not fit the document", () => {
    const document = { list: [1], phase: "lobby" };
    expect(
      applyStatePatch(document, { set: [[["list", "0"], 2]], unset: [] }),
    ).toBeNull();
    expect(
      applyStatePatch(document, { set: [], unset: [["missing"]] }),
    ).toBeNull();
    const polluted = applyStatePatch(
      {},
      { set: [[["__proto__"], { injected: true }]], unset: [] },
    );
    expect(Object.getPrototypeOf(polluted)).toBe(Object.prototype);
    expect(Object.keys(polluted ?? {})).toEqual(["__proto__"]);
  });

  it("ignores frame types it does not know and rejects malformed ones", () => {
    expect(parsePhoneToRoomFrame('{"type":"wave"}').status).toBe("unknown");
    expect(parsePhoneToRoomFrame('{"type":"request","id":-1}').status).toBe(
      "invalid",
    );
    expect(parsePhoneToRoomFrame("not json").status).toBe("invalid");
  });

  it("tells clients which closes end their reconnecting", () => {
    expect(isTerminalRoomClose(roomCloseCodes.replaced.code)).toBe(true);
    expect(isTerminalRoomClose(roomCloseCodes.restarting.code)).toBe(false);
    expect(isTerminalRoomClose(1006)).toBe(false);
  });

  it("addresses rooms by role and code in the path", () => {
    expect(parseRoomPath("/v1/host")).toEqual({ role: "host", code: null });
    expect(parseRoomPath(roomPath({ role: "phone", code: "ABCD" }))).toEqual({
      role: "phone",
      code: "ABCD",
    });
    expect(parseRoomPath("/v1/play")).toBeNull();
    expect(parseRoomPath("/v1/play/ab")).toBeNull();
  });
});
