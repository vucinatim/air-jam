// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PreviewControllerSession } from "../src/preview/manager";
import { useWorkspaceLocalSeats } from "../src/preview/workspace-local-seats";
import type { OpenedLocalSeat } from "../src/runtime/local-seats";

const seat = { key: "keyboard-1", label: "Keyboard 1" };
const origin = "http://localhost:3000";
const session = (id: string, localSeat = seat) =>
  ({
    id,
    localSeat,
    url: `${origin}/controller?room=ABCD`,
  }) as PreviewControllerSession;
const frame = () => {
  const element = document.createElement("iframe");
  document.body.append(element);
  return element;
};
const ready = (source: Window | null, from = origin) => {
  const event = new Event("message");
  Object.assign(event, {
    data: { type: "airjam.local-seat.ready" },
    origin: from,
    source,
  });
  window.dispatchEvent(event);
};

const setup = (canSpawn = true) => {
  const frames = new Map<string, HTMLIFrameElement>();
  const spawn = vi.fn();
  const hook = renderHook(
    (props: { sessions: PreviewControllerSession[]; canSpawn: boolean }) =>
      useWorkspaceLocalSeats({ enabled: true, spawn, frames, ...props }),
    { initialProps: { sessions: [], canSpawn } },
  );
  return { hook, frames, spawn };
};

describe("the workspace's local seats", () => {
  it("opens a seat once the phone launched for its key takes input", async () => {
    const { hook, frames, spawn } = setup();
    let opened: Promise<OpenedLocalSeat | null> = Promise.resolve(null);
    act(() => {
      opened = hook.result.current!.open(seat);
    });
    expect(spawn).toHaveBeenCalledWith({ localSeat: seat });
    const phone = session("one");
    frames.set("one", frame());
    hook.rerender({ sessions: [phone], canSpawn: false });
    ready(frame().contentWindow);
    ready(frames.get("one")!.contentWindow, "https://elsewhere.test");
    ready(frames.get("one")!.contentWindow);
    const seatOpened = await opened;
    expect(seatOpened).not.toBeNull();
    const closed = vi.fn();
    void seatOpened!.closed.then(closed);
    hook.rerender({ sessions: [], canSpawn: true });
    await Promise.resolve();
    expect(closed).toHaveBeenCalled();
  });

  it("refuses a seat when the workspace is full or its phone never appears", async () => {
    const full = setup(false);
    let refused: Promise<OpenedLocalSeat | null> = Promise.resolve(null);
    act(() => {
      refused = full.hook.result.current!.open(seat);
    });
    expect(await refused).toBeNull();
    expect(full.spawn).not.toHaveBeenCalled();

    const lost = setup();
    act(() => {
      refused = lost.hook.result.current!.open(seat);
    });
    lost.hook.rerender({
      sessions: [session("other", { key: "x", label: "X" })],
      canSpawn: true,
    });
    expect(await refused).toBeNull();
  });
});
