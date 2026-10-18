import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { expect, it } from "vitest";
import {
  GameRunWatchWriter,
  MAXIMUM_GAME_WATCH_FRAME_BASE64,
  formatGameRunWatchSurface,
  parseGameRunWatchSurface,
  readGameRunWatchStream,
  type GameRunWatchEvent,
} from "../src/game-run-watch.js";

it("shares one lossless surface codec for CLI arguments and encoded URL paths", () => {
  for (const surface of [
    { kind: "host" } as const,
    { kind: "controller", seatId: "left" } as const,
    { kind: "controller", seatId: "player / : č" } as const,
  ]) {
    const encoded = encodeURIComponent(formatGameRunWatchSurface(surface));
    expect(parseGameRunWatchSurface(decodeURIComponent(encoded))).toEqual(
      surface,
    );
  }
  for (const invalid of [
    "",
    "phone",
    "controller:",
    `controller:${"a".repeat(65)}`,
  ])
    expect(() => parseGameRunWatchSurface(invalid)).toThrow();
});

const frame = (seq: number): GameRunWatchEvent => ({
  type: "frame",
  seq,
  capturedAt: 1000 + seq,
  data: "image",
});
it("bounds slow-writer memory to the newest frame and heartbeat, preserving ready first", () => {
  const written: GameRunWatchEvent[] = [];
  const completions: Array<() => void> = [];
  const output = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, callback) {
      written.push(JSON.parse(chunk.toString()));
      completions.push(callback);
    },
  });
  const writer = new GameRunWatchWriter(output);
  writer.send({
    type: "ready",
    runId: randomUUID(),
    surface: { kind: "host" },
    width: 640,
    height: 360,
  });
  for (let sequence = 0; sequence < 1000; sequence++)
    writer.send(frame(sequence));
  writer.send({ type: "heartbeat", at: 3000, lastFrameSeq: 999 });
  expect(written.map((event) => event.type)).toEqual(["ready"]);
  completions.shift()?.();
  expect(written.map((event) => event.type)).toEqual(["ready", "heartbeat"]);
  completions.shift()?.();
  expect(written.at(-1)).toEqual(frame(999));
  writer.send(frame(1000));
  writer.close();
  completions.shift()?.();
  expect(written).toHaveLength(3);
  expect(output.listenerCount("drain")).toBe(0);
});
function stream(parts: string[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts)
        controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    },
  });
}
it("decodes split NDJSON without inventing or duplicating events", async () => {
  const events: GameRunWatchEvent[] = [];
  const encoded = JSON.stringify(frame(1));
  await readGameRunWatchStream(
    stream([
      encoded.slice(0, 9),
      encoded.slice(9) + "\n",
      JSON.stringify(frame(2)) + "\n",
    ]),
    (event) => events.push(event),
  );
  expect(events).toEqual([frame(1), frame(2)]);
});
it("refuses truncated, oversized and failed producers", async () => {
  await expect(
    readGameRunWatchStream(stream([JSON.stringify(frame(1))]), () => {}),
  ).rejects.toThrow("incomplete");
  await expect(
    readGameRunWatchStream(
      stream(["x".repeat(MAXIMUM_GAME_WATCH_FRAME_BASE64 + 8193)]),
      () => {},
    ),
  ).rejects.toThrow("allowance");
  await expect(
    readGameRunWatchStream(
      stream(['{"type":"error","message":"CDP disconnected"}\n']),
      () => {},
    ),
  ).rejects.toThrow("CDP disconnected");
});
