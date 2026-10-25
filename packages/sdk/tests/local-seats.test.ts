// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { button, defineAirJamInput, stick } from "../src/core/input";
import { defineAirJamInputBindings, wasd } from "../src/core/input-bindings";
import type { LocalInputOperation } from "../src/core/local-input";
import {
  connectParentSeats,
  localSeatMessages,
  startLocalPlayers,
  type LocalSeat,
  type LocalSeatProvider,
  type OpenedLocalSeat,
} from "../src/runtime/local-seats";

const input = defineAirJamInput({ move: stick(), jump: button("pressed") });
const bindings = defineAirJamInputBindings(input, {
  keyboard: [{ move: wasd(), jump: "Space" }],
  gamepad: { jump: "south" },
});

/** A provider whose seats open, refuse and close when the test says. */
const provider = () => {
  const asked: {
    seat: LocalSeat;
    resolve: (opened: OpenedLocalSeat | null) => void;
  }[] = [];
  const seats: LocalSeatProvider = {
    open: (seat) => new Promise((resolve) => asked.push({ seat, resolve })),
  };
  const open = (index: number) => {
    const sent: LocalInputOperation[] = [];
    let close = () => {};
    asked[index].resolve({
      send: (operation) => sent.push(operation),
      closed: new Promise((resolve) => (close = resolve)),
    });
    return { sent, close: () => close() };
  };
  return { seats, asked, open };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const key = (
  type: "keydown" | "keyup",
  code: string,
  target: EventTarget = window,
) => {
  const event = new KeyboardEvent(type, {
    code,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
};

let stops: (() => void)[] = [];
const start = (seats: LocalSeatProvider) => {
  const stop = startLocalPlayers(input, bindings, seats);
  stops.push(stop);
  return stop;
};
afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("local players' seats", () => {
  it("asks for a seat on the first key and sends what queued once it opens", async () => {
    const { seats, asked, open } = provider();
    start(seats);
    key("keydown", "KeyW");
    key("keydown", "KeyD");
    expect(asked.map((entry) => entry.seat)).toEqual([
      { key: "keyboard-1", label: "Keyboard 1" },
    ]);
    const { sent } = open(0);
    await settle();
    expect(sent.at(-1)).toEqual({
      op: "set",
      control: "move",
      value: { x: expect.closeTo(0.707, 3), y: expect.closeTo(-0.707, 3) },
    });
  });

  it("asks again once a seat's phone is removed or the seat was refused", async () => {
    const { seats, asked, open } = provider();
    start(seats);
    key("keydown", "Space");
    asked[0].resolve(null);
    await settle();
    key("keyup", "Space");
    key("keydown", "Space");
    expect(asked).toHaveLength(2);
    const { close } = open(1);
    await settle();
    close();
    await settle();
    key("keyup", "Space");
    key("keydown", "Space");
    expect(asked).toHaveLength(3);
  });

  it("leaves keys aimed at the page's own buttons and fields alone", () => {
    const { seats, asked } = provider();
    start(seats);
    const button = document.createElement("button");
    document.body.append(button);
    const event = key("keydown", "Space", button);
    expect(event.defaultPrevented).toBe(false);
    expect(asked).toHaveLength(0);
  });

  it("lets go of an unplugged gamepad's buttons", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const pressedPad = {
      index: 0,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, index) => ({
        pressed: index === 0,
        value: index === 0 ? 1 : 0,
      })),
    };
    let pads: unknown[] = [pressedPad];
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => pads,
    });
    const { seats, open } = provider();
    start(seats);
    frames.shift()?.(0);
    const { sent } = open(0);
    await settle();
    pads = [null];
    frames.shift()?.(16);
    expect(sent.map((operation) => operation.op)).toEqual([
      "press",
      "release",
      "release-all",
    ]);
  });
});

describe("a parent's seats", () => {
  const parentOrigin = "https://studio.test";
  const fromParent = (source: unknown, data: unknown) => {
    const event = new Event("message");
    Object.assign(event, { data, origin: parentOrigin, source });
    window.dispatchEvent(event);
  };

  it("starts nothing until the parent says it provides seats", () => {
    const parent = { postMessage: vi.fn() };
    const onAvailable = vi.fn();
    const stop = connectParentSeats(
      { window: parent as unknown as Window, origin: parentOrigin },
      onAvailable,
    );
    stops.push(stop);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "airjam.local-seat.query" },
      parentOrigin,
    );
    fromParent({}, localSeatMessages.available());
    expect(onAvailable).not.toHaveBeenCalled();
    fromParent(parent, localSeatMessages.available());
    expect(onAvailable).toHaveBeenCalledTimes(1);
  });

  it("opens, refuses and closes seats as the parent answers", async () => {
    const parent = { postMessage: vi.fn() };
    let seats: LocalSeatProvider | null = null;
    stops.push(
      connectParentSeats(
        { window: parent as unknown as Window, origin: parentOrigin },
        (provider) => (seats = provider),
      ),
    );
    fromParent(parent, localSeatMessages.available());
    const seat = { key: "keyboard-1", label: "Keyboard 1" };
    const refused = seats!.open(seat);
    fromParent(parent, localSeatMessages.refused(seat.key));
    expect(await refused).toBeNull();
    const opening = seats!.open(seat);
    fromParent(parent, localSeatMessages.opened(seat.key));
    const opened = await opening;
    opened!.send({ op: "release-all" });
    expect(parent.postMessage).toHaveBeenLastCalledWith(
      {
        type: "airjam.local-seat.input",
        seat: seat.key,
        operation: { op: "release-all" },
      },
      parentOrigin,
    );
    const closed = vi.fn();
    void opened!.closed.then(closed);
    fromParent(parent, localSeatMessages.closed(seat.key));
    await settle();
    expect(closed).toHaveBeenCalled();
  });
});
