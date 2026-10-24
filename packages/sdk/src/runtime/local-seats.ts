import { z } from "zod";
import type { AirJamInput } from "../core/input";
import { readInputBindings } from "../core/input";
import {
  GamepadSource,
  KeyboardSource,
  localInputOperationSchema,
  LocalInputReceiver,
  RemoteInputTarget,
  type LocalInputOperation,
  type LocalInputTarget,
} from "../core/local-input";

/**
 * A preview phone launched for a local player carries its seat's label in
 * this query parameter, and only such a phone takes local input.
 */
export const AIR_JAM_LOCAL_SEAT_QUERY_PARAM = "airjamLocalSeat";

/** A local player's seat: a stable key per layout or gamepad and the name it plays under. */
export interface LocalSeat {
  key: string;
  label: string;
}

/**
 * Whoever owns preview phones: opens a phone for a seat and resolves with a
 * sender once that phone takes input, or never when it cannot give seats.
 */
export interface LocalSeatProvider {
  open(seat: LocalSeat): Promise<(operation: LocalInputOperation) => void>;
}

const phoneReadySchema = z
  .object({ type: z.literal("airjam.local-seat.ready") })
  .strict();
const phoneInputSchema = z
  .object({
    type: z.literal("airjam.local-seat.input"),
    operation: localInputOperationSchema,
  })
  .strict();
/** What a game frame asks of the product that embeds it. */
export const localSeatRequestSchema = z
  .object({
    type: z.literal("airjam.local-seat.request"),
    seat: z
      .object({
        key: z.string().min(1).max(32),
        label: z.string().min(1).max(32),
      })
      .strict(),
  })
  .strict();
export const localSeatRelaySchema = z
  .object({
    type: z.literal("airjam.local-seat.input"),
    seat: z.string(),
    operation: localInputOperationSchema,
  })
  .strict();
const seatOpenedSchema = z
  .object({ type: z.literal("airjam.local-seat.opened"), seat: z.string() })
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
/** Tells an embedded game frame its seat's phone takes input now. */
export const localSeatOpenedMessage = (seat: string) =>
  ({ type: "airjam.local-seat.opened", seat }) as const;

/** An embedded host asks its parent for seats and relays operations through it. */
export const createParentSeatProvider = (): LocalSeatProvider => ({
  open: (seat) =>
    new Promise((resolve) => {
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window.parent) return;
        const opened = seatOpenedSchema.safeParse(event.data);
        if (!opened.success || opened.data.seat !== seat.key) return;
        window.removeEventListener("message", onMessage);
        resolve((operation) =>
          window.parent.postMessage(
            { type: "airjam.local-seat.input", seat: seat.key, operation },
            "*",
          ),
        );
      };
      window.addEventListener("message", onMessage);
      window.parent.postMessage(
        { type: "airjam.local-seat.request", seat },
        "*",
      );
    }),
});

const MAX_QUEUED_OPERATIONS = 256;

/**
 * A seat's controls, asked for on the first operation that does something:
 * operations queue until its phone is ready, and a release before then is moot.
 */
const seatOnFirstInput = (
  provider: LocalSeatProvider,
  seat: LocalSeat,
): LocalInputTarget => {
  let queue: LocalInputOperation[] | null = null;
  let send: ((operation: LocalInputOperation) => void) | null = null;
  return new RemoteInputTarget((operation) => {
    if (send) return send(operation);
    if (!queue) {
      if (operation.op === "release-all") return;
      queue = [];
      void provider.open(seat).then((sender) => {
        send = sender;
        for (const queued of queue ?? []) sender(queued);
        queue = [];
      });
    }
    queue.push(operation);
    if (queue.length > MAX_QUEUED_OPERATIONS) queue.shift();
  });
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));

/**
 * The host page's local players: each declared keyboard layout and each
 * connected gamepad gets a seat on its first input and drives it while the
 * page has focus.
 */
export const startLocalPlayers = (
  input: AirJamInput,
  provider: LocalSeatProvider,
): (() => void) => {
  const bindings = readInputBindings(input);
  if (!bindings) return () => {};
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
    if (isTyping(event.target)) return;
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
    for (const pad of navigator.getGamepads?.() ?? []) {
      if (!pad || pad.mapping !== "standard") continue;
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

/** The phone side: a local-seat phone applies its parent's operations to its own controls. */
export const listenForLocalSeatInput = (
  target: LocalInputTarget | null,
): (() => void) => {
  if (!target || readLocalSeatLabel() === null || window.parent === window)
    return () => {};
  const receiver = new LocalInputReceiver(target);
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    const message = phoneInputSchema.safeParse(event.data);
    if (message.success) receiver.apply(message.data.operation);
  };
  window.addEventListener("message", onMessage);
  window.parent.postMessage({ type: "airjam.local-seat.ready" }, "*");
  return () => {
    window.removeEventListener("message", onMessage);
    receiver.apply({ op: "release-all" });
  };
};
