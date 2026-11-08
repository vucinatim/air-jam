// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { ControllerInput } from "../src/core/controller-input";
import { button, defineAirJamInput, stick } from "../src/core/input";
import { defineAirJamInputBindings, wasd } from "../src/core/input-bindings";
import {
  LocalInputReceiver,
  type LocalInputOperation,
} from "../src/core/local-input";
import {
  connectParentSeats,
  localSeatMessages,
  serveLocalSeats,
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
  vi.restoreAllMocks();
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

describe("seats served to a game frame", () => {
  const gameOrigin = "https://game.test";
  const seat = { key: "keyboard-1", label: "Keyboard 1" };
  const serve = () => {
    const frame = { postMessage: vi.fn() };
    const server = serveLocalSeats({
      window: () => frame as unknown as Window,
      origin: gameOrigin,
    });
    stops.push(() => server.stop());
    const fromGame = (data: unknown, source: unknown = frame) => {
      const event = new Event("message");
      Object.assign(event, { data, origin: gameOrigin, source });
      window.dispatchEvent(event);
    };
    const said = () => frame.postMessage.mock.calls.map(([message]) => message);
    return { frame, server, fromGame, said };
  };

  it("offers nothing without a provider and refuses its seats", () => {
    const { fromGame, said } = serve();
    fromGame({ type: "airjam.local-seat.query" });
    fromGame({ type: "airjam.local-seat.request", seat });
    expect(said()).toEqual([localSeatMessages.refused(seat.key)]);
  });

  it("opens a seat from its provider and relays the seat's input", async () => {
    const { server, fromGame, said } = serve();
    const { seats, asked, open } = provider();
    server.provide(seats);
    expect(said()).toEqual([localSeatMessages.available()]);
    fromGame({ type: "airjam.local-seat.request", seat });
    fromGame({ type: "airjam.local-seat.request", seat });
    expect(asked).toHaveLength(1);
    const { sent } = open(0);
    await settle();
    expect(said().at(-1)).toEqual(localSeatMessages.opened(seat.key));
    const operation = { op: "release-all" } as const;
    fromGame({ type: "airjam.local-seat.input", seat: seat.key, operation });
    fromGame(
      { type: "airjam.local-seat.input", seat: seat.key, operation },
      window,
    );
    expect(sent).toEqual([operation]);
    fromGame({ type: "airjam.local-seat.request", seat });
    expect(said().at(-1)).toEqual(localSeatMessages.opened(seat.key));
  });

  it("closes a seat whose phone goes away", async () => {
    const { server, fromGame, said } = serve();
    const { seats, open } = provider();
    server.provide(seats);
    fromGame({ type: "airjam.local-seat.request", seat });
    const { sent, close } = open(0);
    await settle();
    close();
    await settle();
    expect(sent).toEqual([{ op: "release-all" }]);
    expect(said().at(-1)).toEqual(localSeatMessages.closed(seat.key));
  });

  it("closes and refuses its seats when its provider is withdrawn, and offers them again", async () => {
    const { server, fromGame, said } = serve();
    const { seats, asked, open } = provider();
    server.provide(seats);
    fromGame({ type: "airjam.local-seat.request", seat });
    open(0);
    await settle();
    const gamepad = { key: "gamepad-1", label: "Gamepad 1" };
    fromGame({ type: "airjam.local-seat.request", seat: gamepad });
    server.provide(null);
    expect(said().slice(-3)).toEqual([
      localSeatMessages.refused(gamepad.key),
      localSeatMessages.closed(seat.key),
      localSeatMessages.unavailable(),
    ]);
    open(1);
    await settle();
    expect(said().at(-1)).toEqual(localSeatMessages.unavailable());
    server.provide(seats);
    expect(said().at(-1)).toEqual(localSeatMessages.available());
    fromGame({ type: "airjam.local-seat.request", seat });
    expect(asked).toHaveLength(3);
  });
});

describe("the local players protocol lifecycle", () => {
  /** Two frame endpoints, with postMessage's asynchronous delivery and source/origin. */
  const connect = () => {
    const parentOrigin = "https://studio.test";
    const gameOrigin = "https://game.test";
    const deliver = (data: object, source: unknown, origin: string) => {
      queueMicrotask(() => {
        const event = new Event("message");
        Object.assign(event, { data, source, origin });
        window.dispatchEvent(event);
      });
    };
    const parent = {
      postMessage: (data: object, origin: string) => {
        expect(origin).toBe(parentOrigin);
        deliver(data, game, gameOrigin);
      },
    };
    const game = {
      postMessage: (data: object, origin: string) => {
        expect(origin).toBe(gameOrigin);
        deliver(data, parent, parentOrigin);
      },
    };
    const server = serveLocalSeats({
      window: () => game as unknown as Window,
      origin: gameOrigin,
    });
    stops.push(() => server.stop());
    let stopPlayers = () => {};
    const available = vi.fn((seats: LocalSeatProvider) => {
      stopPlayers = startLocalPlayers(input, bindings, seats);
    });
    const unavailable = vi.fn(() => {
      stopPlayers();
      stopPlayers = () => {};
    });
    stops.push(
      connectParentSeats(
        { window: parent as unknown as Window, origin: parentOrigin },
        available,
        unavailable,
      ),
    );
    return { server, available, unavailable };
  };

  it("returns keys and gamepads to the game on off, releases held input, and starts again on on", async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const getGamepads = vi.fn(() => []);
    vi.stubGlobal("navigator", { getGamepads });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const tick = () => {
      const ready = [...frames.values()];
      frames.clear();
      for (const callback of ready) callback(0);
    };
    const phone = new ControllerInput(input, {
      send: () => {},
      requestFrame: () => {},
    });
    const receiver = new LocalInputReceiver(phone);
    const sent: LocalInputOperation[] = [];
    const seats: LocalSeatProvider = {
      open: vi.fn(async () => ({
        send: (operation: LocalInputOperation) => {
          sent.push(operation);
          receiver.apply(operation);
        },
        closed: new Promise<void>(() => {}),
      })),
    };
    const { server, available, unavailable } = connect();
    await settle();
    expect(key("keydown", "KeyW").defaultPrevented).toBe(false);
    tick();
    expect(getGamepads).not.toHaveBeenCalled();

    server.provide(seats);
    await settle();
    expect(available).toHaveBeenCalledTimes(1);
    expect(key("keydown", "KeyW").defaultPrevented).toBe(true);
    key("keydown", "Space");
    tick();
    await settle();
    expect(getGamepads).toHaveBeenCalledTimes(1);
    expect(phone.value("move")).toEqual({ x: 0, y: -1 });
    expect(phone.isDown("jump")).toBe(true);

    // No keyup: withdrawal itself must release the phone, before closing its route.
    server.provide(null);
    expect(sent.at(-1)).toEqual({ op: "release-all" });
    expect(phone.value("move")).toEqual({ x: 0, y: 0 });
    expect(phone.isDown("jump")).toBe(false);
    await settle();
    expect(unavailable).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    expect(key("keydown", "KeyW").defaultPrevented).toBe(false);
    tick();
    expect(getGamepads).toHaveBeenCalledTimes(1);

    server.provide(seats);
    await settle();
    expect(available).toHaveBeenCalledTimes(2);
    expect(key("keydown", "KeyW").defaultPrevented).toBe(true);
    tick();
    await settle();
    expect(getGamepads).toHaveBeenCalledTimes(2);
    expect(phone.value("move")).toEqual({ x: 0, y: -1 });
    expect(seats.open).toHaveBeenCalledTimes(2);
  }, 1000);

  it("settles a pending open on withdrawal so it cannot send queued holds after off", async () => {
    const { seats, asked, open } = provider();
    const { server } = connect();
    server.provide(seats);
    await settle();
    key("keydown", "KeyW");
    await settle();
    expect(asked).toHaveLength(1);
    server.provide(null);
    await settle();
    const { sent } = open(0);
    await settle();
    expect(sent).toEqual([]);
    expect(key("keydown", "KeyW").defaultPrevented).toBe(false);
  }, 1000);
});
