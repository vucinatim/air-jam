import { expect, it } from "vitest";
import {
  AIR_JAM_INPUT_LOG_MAX_ENTRY_BYTES,
  AIR_JAM_INPUT_LOG_MAX_GAME_MS,
  InputRecorder,
} from "../src/core/input-log";

const header = {
  seed: 17,
  settings: {},
  stepMs: 10,
  storeDomain: "default",
};

it("freezes at the last whole step before 30 minutes, excluding pending events", () => {
  const recorder = new InputRecorder();
  const stepMs = 700_000;
  recorder.record("server:state", { state: "playing" });
  recorder.flush(1, [], stepMs);
  recorder.flush(2, [], stepMs);
  recorder.record("server:state", { state: "paused" });
  const before = recorder.log({ ...header, stepMs });
  recorder.flush(3, [], stepMs);
  recorder.record("server:state", { ignored: true });
  recorder.flush(4, [], stepMs);
  expect(recorder.full).toBe(true);
  const log = recorder.log({ ...header, stepMs });
  expect(log.ticks).toBe(2);
  expect(log.ticks * stepMs).toBeLessThanOrEqual(AIR_JAM_INPUT_LOG_MAX_GAME_MS);
  expect(log.entries).toEqual(before.entries.slice(0, 1));
  // A cut already seen by a reader survives a later freeze.
  expect(
    recorder.log(header, { ticks: 2, entryCount: before.entries.length })
      .entries,
  ).toEqual(before.entries);
});

it("allows the exact time limit and freezes before the next whole step", () => {
  const recorder = new InputRecorder();
  recorder.flush(1, [], AIR_JAM_INPUT_LOG_MAX_GAME_MS);
  expect(recorder.full).toBe(false);
  recorder.flush(2, [], AIR_JAM_INPUT_LOG_MAX_GAME_MS);
  expect(recorder.full).toBe(true);
  expect(recorder.log(header).ticks).toBe(1);
});

it.each(["record", "flush"])(
  "freezes on entry bytes during %s, rolling back the incomplete step",
  (lane) => {
    const recorder = new InputRecorder();
    const payload = {
      value: "x".repeat(AIR_JAM_INPUT_LOG_MAX_ENTRY_BYTES / 4),
    };
    recorder.record("server:state", payload);
    recorder.flush(1, [], 10);
    recorder.record("server:state", payload);
    const cut = recorder.log(header);
    if (lane === "record") {
      recorder.record("server:state", payload);
      recorder.record("server:state", payload);
    } else
      recorder.flush(
        2,
        [
          { event: "server:state", payload },
          { event: "server:state", payload },
        ],
        10,
      );
    expect(recorder.full).toBe(true);
    const log = recorder.log(header);
    expect(log.ticks).toBe(1);
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0].tick).toBe(1);
    expect(JSON.stringify(log.entries[0]).length).toBeLessThan(
      AIR_JAM_INPUT_LOG_MAX_ENTRY_BYTES,
    );
    recorder.flush(3, [], 10);
    expect(recorder.log(header).ticks).toBe(1);
    expect(
      recorder.log(header, { ticks: 1, entryCount: cut.entries.length })
        .entries,
    ).toEqual(cut.entries);
  },
);

it("keeps pending events at the same positions and ticks when flushed", () => {
  const recorder = new InputRecorder();
  recorder.record("server:state", { state: "playing" });
  const cut = recorder.log(header);
  recorder.record("server:controllerLeft", { controllerId: "one" });
  recorder.flush(1, [{ event: "server:input", payload: { direction: 1 } }], 10);
  recorder.record("server:state", { state: "paused" });
  expect(recorder.log(header).entries.slice(0, cut.entries.length)).toEqual(
    cut.entries,
  );
});
