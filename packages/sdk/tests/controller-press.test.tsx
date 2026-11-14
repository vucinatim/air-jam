// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { captureControllerDocument } from "../src/runtime/controller-capture";
import { pressControllerDocument } from "../src/runtime/controller-press";

vi.mock("../src/runtime/controller-capture", () => ({
  captureControllerDocument: vi.fn(),
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(captureControllerDocument).mockResolvedValue({
    status: "unavailable",
    reason: "unsupported",
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const signal = () => new AbortController().signal;
function pointAt(element: Element | null) {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: vi.fn(() => element),
  });
}

it("taps a React button and guards its synthetic pointer capture", async () => {
  const click = vi.fn();
  const { getByRole } = render(
    <button
      onPointerDown={(event) =>
        event.currentTarget.setPointerCapture(event.pointerId)
      }
      onClick={click}
    >
      Vote
    </button>,
  );
  pointAt(getByRole("button"));
  let result;
  await act(async () => {
    const pending = pressControllerDocument(
      { kind: "tap", x: 0.5, y: 0.25 },
      signal(),
    );
    await vi.advanceTimersByTimeAsync(50);
    result = await pending;
  });
  expect(click).toHaveBeenCalledOnce();
  expect(result).toMatchObject({
    press: { status: "done", target: { tag: "button", label: "Vote" } },
  });
  expect(document.elementFromPoint).toHaveBeenCalledWith(
    innerWidth / 2,
    innerHeight / 4,
  );
});

it("captures a committed React reveal while held and always releases afterwards", async () => {
  function Reveal() {
    const [held, setHeld] = useState(false);
    return (
      <button
        onPointerDown={() => setHeld(true)}
        onPointerUp={() => setHeld(false)}
      >
        {held ? "secret" : "hold"}
      </button>
    );
  }
  const { getByRole } = render(<Reveal />);
  const button = getByRole("button");
  pointAt(button);
  const click = vi.fn();
  button.addEventListener("click", click);
  vi.mocked(captureControllerDocument).mockImplementation(async () => {
    expect(button.textContent).toBe("secret");
    return { status: "unavailable", reason: "unsupported" };
  });
  let pending: ReturnType<typeof pressControllerDocument>;
  await act(async () => {
    pending = pressControllerDocument(
      { kind: "hold", x: 0.5, y: 0.5, durationMs: 100 },
      signal(),
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(150);
    await pending;
  });
  expect(button.textContent).toBe("hold");
  expect(click).not.toHaveBeenCalled();
});

it("types into a controlled React field and submits its form", async () => {
  const submitted = vi.fn();
  function Clue() {
    const [text, setText] = useState("");
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitted(text);
        }}
      >
        <input
          aria-label="Clue"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <output>{text}</output>
      </form>
    );
  }
  const { getByRole, container } = render(<Clue />);
  getByRole("textbox").focus();
  await act(async () => {
    const pending = pressControllerDocument(
      { kind: "type", text: "orchard", submit: true },
      signal(),
    );
    await vi.advanceTimersByTimeAsync(100);
    await pending;
  });
  expect(container.querySelector("output")?.textContent).toBe("orchard");
  expect(submitted).toHaveBeenCalledExactlyOnceWith("orchard");
});

it("reports empty coordinates and an unfocused text field as misses", async () => {
  pointAt(null);
  const pending = pressControllerDocument(
    { kind: "tap", x: 0, y: 0 },
    signal(),
  );
  await vi.advanceTimersByTimeAsync(50);
  expect(await pending).toMatchObject({
    press: { status: "missed", reason: "no-target" },
  });
  const typing = pressControllerDocument(
    { kind: "type", text: "clue" },
    signal(),
  );
  await vi.advanceTimersByTimeAsync(50);
  expect(await typing).toMatchObject({
    press: { status: "missed", reason: "not-editable" },
  });
});
