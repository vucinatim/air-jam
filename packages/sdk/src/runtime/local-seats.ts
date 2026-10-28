import { z } from "zod";
import type { AirJamInput } from "../core/input";
import type { AirJamInputBindings } from "../core/input-bindings";
import {
  GamepadSource,
  KeyboardSource,
  localInputOperationSchema,
  LocalInputReceiver,
  RemoteInputTarget,
  type LocalInputOperation,
  type LocalInputTarget,
} from "../core/local-input";
import { readPreviewControllerParent } from "../preview/identity";

/**
 * A preview phone launched for a local player carries its seat's label in
 * this query parameter, as its player name, and only such a phone takes
 * local input.
 */
export const AIR_JAM_LOCAL_SEAT_QUERY_PARAM = "airjamLocalSeat";

/** A local player's seat: a stable key per layout or gamepad and the name it plays under. */
export interface LocalSeat {
  key: string;
  label: string;
}

/** A seat whose phone takes input: how to reach it, and when it goes away. */
export interface OpenedLocalSeat {
  send: (operation: LocalInputOperation) => void;
  /** Settles when the seat's phone is removed; the next input asks again. */
  closed: Promise<void>;
}

/** Whoever owns preview phones: opens a phone for a seat, or refuses with null. */
export interface LocalSeatProvider {
  open(seat: LocalSeat): Promise<OpenedLocalSeat | null>;
}

const seatSchema = z
  .object({
    key: z.string().min(1).max(32),
    label: z.string().min(1).max(32),
  })
  .strict();
const seatMessage = <TType extends string>(type: TType) =>
  z.object({ type: z.literal(type), seat: z.string() }).strict();
const phoneReadySchema = z
  .object({ type: z.literal("airjam.local-seat.ready") })
  .strict();
const phoneInputSchema = z
  .object({
    type: z.literal("airjam.local-seat.input"),
    operation: localInputOperationSchema,
  })
  .strict();
const availableSchema = z
  .object({ type: z.literal("airjam.local-seat.available") })
  .strict();
const openedSchema = seatMessage("airjam.local-seat.opened");
const refusedSchema = seatMessage("airjam.local-seat.refused");
const closedSchema = seatMessage("airjam.local-seat.closed");

/*
 * The seat protocol between an embedded game host and the product that
 * frames it, with every message posted to a declared origin:
 *
 * - host → parent `airjam.local-seat.query`; a parent that provides seats
 *   answers `airjam.local-seat.available`, and only then does the host take
 *   keys and gamepads.
 * - host → parent `airjam.local-seat.request` with a seat; the parent answers
 *   `opened` once that seat's phone takes input, or `refused`, and later
 *   `closed` when the phone is removed.
 * - host → parent `airjam.local-seat.input` with the seat's key and one
 *   operation, which the parent hands to the seat's phone.
 *
 * A seat's phone takes operations only from its direct parent frame, at the
 * parent origin its preview launch declares (`parentOrigin`, else the phone's
 * own origin), and says `airjam.local-seat.ready` to it. A product showing a phone in its own
 * window frames the phone in a page of its own and relays to that page; it
 * never messages a phone in another window directly.
 */

/** What a game frame asks of the product that embeds it. */
export const localSeatRequestSchema = z
  .object({ type: z.literal("airjam.local-seat.request"), seat: seatSchema })
  .strict();
export const localSeatQuerySchema = z
  .object({ type: z.literal("airjam.local-seat.query") })
  .strict();
export const localSeatRelaySchema = z
  .object({
    type: z.literal("airjam.local-seat.input"),
    seat: z.string(),
    operation: localInputOperationSchema,
  })
  .strict();

/** Sends one operation to a local-seat phone's frame. */
export const sendLocalSeatOperation = (
  frame: Window,
  origin: string,
  operation: LocalInputOperation,
): void =>
  frame.postMessage({ type: "airjam.local-seat.input", operation }, origin);
/** Whether a message is a local-seat phone announcing it takes input. */
export const isLocalSeatReadyMessage = (data: unknown): boolean =>
  phoneReadySchema.safeParse(data).success;
/** What a product tells an embedded game frame about its seats. */
export const localSeatMessages = {
  available: () => ({ type: "airjam.local-seat.available" }) as const,
  opened: (seat: string) =>
    ({ type: "airjam.local-seat.opened", seat }) as const,
  refused: (seat: string) =>
    ({ type: "airjam.local-seat.refused", seat }) as const,
  closed: (seat: string) =>
    ({ type: "airjam.local-seat.closed", seat }) as const,
};

/** A frame's parent and the origin it may talk to. */
export interface LocalSeatParent {
  window: Window;
  origin: string;
}

/**
 * An embedded host asks its declared parent whether it provides seats and
 * calls `onAvailable` with a provider once it says so; a parent that never
 * answers leaves the host's keys and gamepads alone. Stops listening when
 * the returned function is called.
 */
export const connectParentSeats = (
  parent: LocalSeatParent,
  onAvailable: (provider: LocalSeatProvider) => void,
): (() => void) => {
  const stop = new AbortController();
  const fromParent = (event: MessageEvent) =>
    event.source === parent.window && event.origin === parent.origin;
  const listen = (onMessage: (event: MessageEvent) => void) =>
    window.addEventListener(
      "message",
      (event) => {
        if (fromParent(event)) onMessage(event);
      },
      { signal: stop.signal },
    );
  const post = (message: object) =>
    parent.window.postMessage(message, parent.origin);

  const closings = new Map<string, () => void>();
  const pending = new Map<string, (opened: OpenedLocalSeat | null) => void>();
  let announced = false;
  listen((event) => {
    if (availableSchema.safeParse(event.data).success) {
      if (announced) return;
      announced = true;
      onAvailable({
        open: (seat) =>
          new Promise((resolve) => {
            pending.set(seat.key, resolve);
            post({ type: "airjam.local-seat.request", seat });
          }),
      });
      return;
    }
    const opened = openedSchema.safeParse(event.data);
    if (opened.success) {
      const key = opened.data.seat;
      const resolve = pending.get(key);
      if (!resolve) return;
      pending.delete(key);
      resolve({
        send: (operation) =>
          post({ type: "airjam.local-seat.input", seat: key, operation }),
        closed: new Promise((close) => closings.set(key, close)),
      });
      return;
    }
    const refused = refusedSchema.safeParse(event.data);
    if (refused.success) {
      pending.get(refused.data.seat)?.(null);
      pending.delete(refused.data.seat);
      return;
    }
    const closed = closedSchema.safeParse(event.data);
    if (closed.success) {
      closings.get(closed.data.seat)?.();
      closings.delete(closed.data.seat);
    }
  });
  post({ type: "airjam.local-seat.query" });
  return () => stop.abort();
};

const MAX_QUEUED_OPERATIONS = 256;

/**
 * A seat's controls, asked for on the first operation that does something:
 * operations queue until its phone is ready, a release before then is moot,
 * and a refused or closed seat is asked for again on the next one.
 */
const seatOnFirstInput = (
  provider: LocalSeatProvider,
  seat: LocalSeat,
): LocalInputTarget => {
  type State =
    | { kind: "closed" }
    | { kind: "opening"; queue: LocalInputOperation[] }
    | { kind: "open"; send: OpenedLocalSeat["send"] };
  const closed: State = { kind: "closed" };
  let state: State = closed;
  return new RemoteInputTarget((operation) => {
    if (state.kind === "open") return state.send(operation);
    if (state.kind === "closed") {
      if (operation.op === "release" || operation.op === "release-all") return;
      const opening = {
        kind: "opening" as const,
        queue: [] as LocalInputOperation[],
      };
      state = opening;
      void provider.open(seat).then((opened) => {
        if (state !== opening) return;
        if (!opened) {
          state = closed;
          return;
        }
        const open = { kind: "open" as const, send: opened.send };
        state = open;
        for (const queued of opening.queue) opened.send(queued);
        void opened.closed.then(() => {
          if (state === open) state = closed;
        });
      });
    }
    state.queue.push(operation);
    if (state.queue.length > MAX_QUEUED_OPERATIONS) state.queue.shift();
  });
};

/** Keys aimed at the page's own controls, such as typing or activating a button. */
const isInteractive = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.closest(
      "input, select, textarea, button, a[href], summary, [role=button], [role=link], [role=menuitem], [role=tab]",
    ) !== null);

/**
 * The host page's local players: each declared keyboard layout and each
 * connected gamepad gets a seat on its first input and drives it while the
 * page has focus.
 */
export const startLocalPlayers = (
  input: AirJamInput,
  bindings: AirJamInputBindings,
  provider: LocalSeatProvider,
): (() => void) => {
  const layouts = bindings.keyboard ?? [];
  const keyboards = layouts.map(
    (layout, index) =>
      new KeyboardSource(
        layout,
        seatOnFirstInput(provider, {
          key: `keyboard-${index + 1}`,
          label: `Keyboard ${index + 1}`,
        }),
      ),
  );
  const gamepads = new Map<number, GamepadSource>();

  const keydown = (event: KeyboardEvent) => {
    if (isInteractive(event.target)) return;
    for (const keyboard of keyboards)
      if (keyboard.handles(event.code)) {
        event.preventDefault();
        keyboard.keyDown(event.code, event.repeat);
      }
  };
  const keyup = (event: KeyboardEvent) => {
    for (const keyboard of keyboards) keyboard.keyUp(event.code);
  };
  const releaseAll = () => {
    for (const keyboard of keyboards) keyboard.release();
    for (const gamepad of gamepads.values()) gamepad.release();
  };
  const releaseWhenHidden = () => {
    if (document.hidden) releaseAll();
  };

  let frame = 0;
  const poll = () => {
    frame = requestAnimationFrame(poll);
    if (!bindings.gamepad || !document.hasFocus()) return;
    const connected = new Set<number>();
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad || pad.mapping !== "standard") continue;
      connected.add(pad.index);
      let source = gamepads.get(pad.index);
      if (!source) {
        source = new GamepadSource(
          bindings.gamepad,
          input,
          seatOnFirstInput(provider, {
            key: `gamepad-${pad.index + 1}`,
            label: `Gamepad ${pad.index + 1}`,
          }),
        );
        gamepads.set(pad.index, source);
      }
      source.update(pad);
    }
    // An unplugged pad lets go of everything; plugged in again, it starts clean.
    for (const [index, source] of gamepads)
      if (!connected.has(index)) {
        source.release();
        gamepads.delete(index);
      }
  };

  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", releaseWhenHidden);
  if (bindings.gamepad) frame = requestAnimationFrame(poll);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", keydown);
    window.removeEventListener("keyup", keyup);
    window.removeEventListener("blur", releaseAll);
    document.removeEventListener("visibilitychange", releaseWhenHidden);
    releaseAll();
  };
};

/** The seat label a local-seat phone was launched with, or null for an ordinary phone. */
export const readLocalSeatLabel = (): string | null =>
  typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get(
        AIR_JAM_LOCAL_SEAT_QUERY_PARAM,
      );

/**
 * The phone side: a local-seat phone applies operations from the parent its
 * preview launch declares to its own controls.
 */
export const listenForLocalSeatInput = (
  target: LocalInputTarget | null,
): (() => void) => {
  const parent = readPreviewControllerParent();
  if (!target || readLocalSeatLabel() === null || !parent) return () => {};
  const receiver = new LocalInputReceiver(target);
  const onMessage = (event: MessageEvent) => {
    if (event.source !== parent.window || event.origin !== parent.origin)
      return;
    const message = phoneInputSchema.safeParse(event.data);
    if (message.success) receiver.apply(message.data.operation);
  };
  window.addEventListener("message", onMessage);
  parent.window.postMessage({ type: "airjam.local-seat.ready" }, parent.origin);
  return () => {
    window.removeEventListener("message", onMessage);
    receiver.apply({ op: "release-all" });
  };
};
