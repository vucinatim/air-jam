import { afterEach, describe, expect, it, vi } from "vitest";
import { GameSessionOperations } from "../src/game-session-operations.js";
afterEach(() => vi.useRealTimers());
describe("session operation lifetime", () => {
  it("serializes one session and lets independent sessions proceed", async () => {
    const first = new GameSessionOperations(),
      second = new GameSessionOperations();
    let release: () => void = () => {};
    const order: string[] = [];
    const held = first.run(1000, async () => {
      order.push("start");
      await new Promise<void>((resolve) => (release = resolve));
      order.push("end");
    });
    const queued = first.run(1000, async () => {
      order.push("queued");
    });
    await second.run(1000, async () => {
      order.push("other");
    });
    expect(order).toEqual(["start", "other"]);
    release();
    await Promise.all([held, queued]);
    expect(order).toEqual(["start", "other", "end", "queued"]);
  });
  it("close aborts an active request and rejects queued work before it starts", async () => {
    const operations = new GameSessionOperations();
    const work = vi.fn();
    const active = operations.run(1000, async () => new Promise(() => {}));
    const queued = operations.run(1000, work);
    const results = Promise.allSettled([active, queued]);
    await Promise.resolve();
    operations.close();
    expect(
      (await results).every((result) => result.status === "rejected"),
    ).toBe(true);
    expect(work).not.toHaveBeenCalled();
    await expect(operations.run(1000, work)).rejects.toThrow("session_closed");
  });
  it("marks timeout as terminal without retrying a possibly applied action", async () => {
    vi.useFakeTimers();
    const operations = new GameSessionOperations();
    let calls = 0;
    const active = operations.run(10, async () => {
      calls++;
      return new Promise(() => {});
    });
    const checked = expect(active).rejects.toThrow("evaluation_timeout");
    await vi.advanceTimersByTimeAsync(11);
    await checked;
    await expect(operations.run(10, async () => calls++)).rejects.toThrow(
      "evaluation_timeout",
    );
    expect(calls).toBe(1);
    operations.close();
  });
});
