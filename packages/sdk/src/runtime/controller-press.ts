import type {
  ControllerFrameCapture,
  ControllerPressAction,
  ControllerPressResult,
} from "./contracts/controller-agent";
import { captureControllerDocument } from "./controller-capture";

const pointerId = 2147483000;

function describeTarget(element: Element) {
  const labelledBy = element.getAttribute("aria-labelledby");
  const label = (
    element.getAttribute("aria-label") ||
    (labelledBy &&
      labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" ")) ||
    (element instanceof HTMLInputElement &&
      Array.from(element.labels ?? [])
        .map((label) => label.textContent)
        .join(" ")) ||
    element.textContent ||
    ""
  )
    .trim()
    .slice(0, 120);
  const role = element.getAttribute("role");
  return {
    tag: element.tagName.toLowerCase(),
    ...(role ? { role } : {}),
    ...(label ? { label } : {}),
  };
}

function paint(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      });
    });
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function wait(durationMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, durationMs);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Synthetic pointers are not registered with the browser's native capture registry. */
function guardPointerCapture() {
  const prototype = Element.prototype;
  const originals = [
    "setPointerCapture",
    "releasePointerCapture",
    "hasPointerCapture",
  ] as const;
  const descriptors = originals.map((name) =>
    Object.getOwnPropertyDescriptor(prototype, name),
  );
  for (const name of originals) {
    const original: (this: Element, id: number) => boolean | void =
      prototype[name];
    Object.defineProperty(prototype, name, {
      configurable: true,
      writable: true,
      value: function (this: Element, id: number) {
        if (id === pointerId)
          return name === "hasPointerCapture" ? true : undefined;
        return original.call(this, id);
      },
    });
  }
  return () =>
    originals.forEach((name, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(prototype, name, descriptor);
      else Reflect.deleteProperty(prototype, name);
    });
}

export async function pressControllerDocument(
  action: ControllerPressAction,
  signal: AbortSignal,
): Promise<{ press: ControllerPressResult; capture: ControllerFrameCapture }> {
  signal.throwIfAborted();
  let press: ControllerPressResult;
  let release = () => {};
  const restore = guardPointerCapture();
  try {
    if (action.kind === "type") {
      const element = document.activeElement;
      const textInput =
        element instanceof HTMLTextAreaElement ||
        (element instanceof HTMLInputElement &&
          [
            "text",
            "search",
            "email",
            "url",
            "tel",
            "password",
            "number",
          ].includes(element.type));
      if (
        !(element instanceof HTMLElement) ||
        (!textInput && !element.isContentEditable) ||
        (textInput && (element.disabled || element.readOnly))
      ) {
        press = { status: "missed", reason: "not-editable" };
      } else {
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement
        ) {
          const prototype =
            element instanceof HTMLInputElement
              ? HTMLInputElement.prototype
              : HTMLTextAreaElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
            element,
            action.text,
          );
        } else element.textContent = action.text;
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: "insertText",
            data: action.text,
          }),
        );
        element.dispatchEvent(
          new Event("change", { bubbles: true, composed: true }),
        );
        if (action.submit) {
          await paint(signal);
          const allowed = element.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              bubbles: true,
              composed: true,
              cancelable: true,
            }),
          );
          element.dispatchEvent(
            new KeyboardEvent("keyup", {
              key: "Enter",
              code: "Enter",
              bubbles: true,
              composed: true,
            }),
          );
          if (allowed) {
            const form =
              element instanceof HTMLInputElement ||
              element instanceof HTMLTextAreaElement
                ? element.form
                : element.closest("form");
            form?.requestSubmit();
          }
        }
        press = { status: "done", target: describeTarget(element) };
      }
    } else {
      const clientX = Math.min(action.x * innerWidth, innerWidth - 1);
      const clientY = Math.min(action.y * innerHeight, innerHeight - 1);
      const element = document.elementFromPoint(clientX, clientY);
      if (!element) press = { status: "missed", reason: "no-target" };
      else {
        const eventOptions = {
          bubbles: true,
          composed: true,
          cancelable: true,
          clientX,
          clientY,
          button: 0,
        };
        const pointer = (type: string, pressed: boolean) =>
          element.dispatchEvent(
            new PointerEvent(type, {
              ...eventOptions,
              bubbles: type !== "pointerenter" && type !== "pointerleave",
              pointerId,
              pointerType: "touch",
              isPrimary: true,
              buttons: pressed ? 1 : 0,
              pressure: pressed ? 0.5 : 0,
            }),
          );
        const mouse = (type: string, pressed: boolean) =>
          element.dispatchEvent(
            new MouseEvent(type, { ...eventOptions, buttons: pressed ? 1 : 0 }),
          );
        const touch = (type: string, pressed: boolean) => {
          if (typeof Touch === "undefined" || typeof TouchEvent === "undefined")
            return;
          const contact = new Touch({
            identifier: pointerId,
            target: element,
            clientX,
            clientY,
          });
          element.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              composed: true,
              cancelable: true,
              touches: pressed ? [contact] : [],
              targetTouches: pressed ? [contact] : [],
              changedTouches: [contact],
            }),
          );
        };
        pointer("pointerover", false);
        pointer("pointerenter", false);
        let pressed = true;
        release = () => {
          if (!pressed) return;
          pressed = false;
          pointer("pointerup", false);
          touch("touchend", false);
          mouse("mouseup", false);
        };
        const allowed = pointer("pointerdown", true);
        touch("touchstart", true);
        if (allowed && mouse("mousedown", true)) {
          const focusable = element.closest<HTMLElement>(
            "button,input,textarea,select,a[href],[tabindex],[contenteditable]",
          );
          focusable?.focus();
        }
        press = { status: "done", target: describeTarget(element) };
        if (action.kind === "hold") await wait(action.durationMs, signal);
        else {
          release();
          release = () => {};
          mouse("click", false);
          pointer("pointerout", false);
          pointer("pointerleave", false);
        }
      }
    }
    signal.addEventListener("abort", release, { once: true });
    await paint(signal);
    return { press, capture: await captureControllerDocument(signal) };
  } finally {
    signal.removeEventListener("abort", release);
    release();
    restore();
  }
}
