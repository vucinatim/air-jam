// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PreviewControllerSession } from "../src/preview/manager";
import { useWorkspaceLocalSeats } from "../src/preview/workspace-local-seats";
import type { LocalSeat, OpenedLocalSeat } from "../src/runtime/local-seats";

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

/** The hook with sessions that a spawn adds in the same update, like the manager. */
const setup = (canSpawn = true, phoneAppears = true) => {
  const frames = new Map<string, HTMLIFrameElement>();
  const spawn = vi.fn();
  const hook = renderHook(() => {
    const [sessions, setSessions] = useState<PreviewControllerSession[]>([]);
    const spawnPhone = useCallback((options: { localSeat: LocalSeat }) => {
      spawn(options);
      if (phoneAppears)
        setSessions((current) => [
          ...current,
          session(`phone-${current.length + 1}`, options.localSeat),
        ]);
    }, []);
    return {
      provider: useWorkspaceLocalSeats({
        enabled: true,
        sessions,
        canSpawn,
        spawn: spawnPhone,
        frames,
      }),
      setSessions,
    };
  });
  return { hook, frames, spawn };
};

describe("the workspace's local seats", () => {
  it("opens a seat once the phone launched for its key takes input, and at once when asked again", async () => {
    const { hook, frames, spawn } = setup();
    let opened: Promise<OpenedLocalSeat | null> = Promise.resolve(null);
    act(() => {
      opened = hook.result.current.provider!.open(seat);
    });
    expect(spawn).toHaveBeenCalledWith({ localSeat: seat });
    frames.set("phone-1", frame());
    ready(frame().contentWindow);
    ready(frames.get("phone-1")!.contentWindow, "https://elsewhere.test");
    ready(frames.get("phone-1")!.contentWindow);
    const seatOpened = await opened;
    expect(seatOpened).not.toBeNull();

    const superseded = vi.fn();
    void seatOpened!.closed.then(superseded);
    let again: Promise<OpenedLocalSeat | null> = Promise.resolve(null);
    act(() => {
      again = hook.result.current.provider!.open(seat);
    });
    const reopened = await again;
    expect(reopened).not.toBeNull();
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(superseded).toHaveBeenCalled();

    const closed = vi.fn();
    void reopened!.closed.then(closed);
    act(() => hook.result.current.setSessions([]));
    await Promise.resolve();
    expect(closed).toHaveBeenCalled();
  });

  it("refuses a seat when the workspace is full or its phone never appears", async () => {
    for (const [canSpawn, phoneAppears] of [
      [false, true],
      [true, false],
    ]) {
      const { hook } = setup(canSpawn, phoneAppears);
      let refused: Promise<OpenedLocalSeat | null> = Promise.resolve(null);
      act(() => {
        refused = hook.result.current.provider!.open(seat);
      });
      expect(await refused).toBeNull();
    }
  });
});
