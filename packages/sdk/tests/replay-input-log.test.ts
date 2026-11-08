import { expect, it, vi } from "vitest";
import {
  defineAirJamSettings,
  defineAirJamSimulation,
  HostRuntime,
  openAirJamReplay,
  setting,
  type AirJamInputLog,
} from "../src/core";

const log: AirJamInputLog = {
  version: 2,
  seed: 123,
  settings: { speed: 1 },
  stepMs: 10,
  ticks: 3,
  storeDomain: "default",
  entries: [
    {
      tick: 2,
      event: "airjam:settings",
      payload: { patch: { speed: 2 }, revision: 1 },
    },
    {
      tick: 4,
      event: "airjam:settings",
      payload: { patch: { speed: 3 }, revision: 2 },
    },
  ],
};
const open = (recorded = log) =>
  openAirJamReplay(
    (dependencies, options) =>
      new HostRuntime(
        {
          ...dependencies,
          stores: [],
          settings: defineAirJamSettings({
            speed: setting.number({ default: 1, min: 1, max: 3, live: true }),
          }),
          simulation: defineAirJamSimulation<
            { path: number[] },
            unknown,
            never,
            { speed: number }
          >({
            stepMs: 10,
            create: () => ({ path: [] }),
            step: (sim, { settings }) => {
              sim.path.push(settings.speed);
            },
          }),
        },
        options,
      ),
    recorded,
  );

it("carries sub-step milliseconds, mixes whole steps and clamps, applying trailing entries once", async () => {
  const replay = await open();
  const update = vi.spyOn(replay.runtime, "updateSettings");
  try {
    expect(replay.tick).toBe(0);
    expect(replay.ticks).toBe(3);
    expect(replay.done).toBe(false);
    expect(replay.advance({ ms: 4 })).toBe(0);
    expect(replay.advance({ steps: 1 })).toBe(1);
    expect(replay.advance({ ms: 5 })).toBe(1);
    expect(replay.advance({ ms: 1 })).toBe(2);
    expect(replay.runtime.simulation?.sim).toEqual({ path: [1, 2] });
    expect(replay.advance({ steps: 999 })).toBe(3);
    expect(replay.done).toBe(true);
    expect(replay.runtime.simulation?.sim).toEqual({ path: [1, 2, 2] });
    expect(replay.runtime.settings.read()).toMatchObject({
      values: { speed: 3 },
      revision: 2,
    });
    expect(replay.advance({ ms: 10_000 })).toBe(3);
    expect(replay.advance({ steps: 1 })).toBe(3);
    expect(update).toHaveBeenCalledTimes(2);
    expect(() => replay.advance({ steps: -1 })).toThrow();
    expect(() => replay.advance({ steps: 1.5 })).toThrow();
    expect(() => replay.advance({ ms: Number.NaN })).toThrow();
  } finally {
    replay.stop();
  }
});

it("finishes an empty recording and applies its trailing entries at open", async () => {
  const replay = await open({
    ...log,
    ticks: 0,
    entries: [
      {
        tick: 1,
        event: "airjam:settings",
        payload: { patch: { speed: 2 }, revision: 1 },
      },
    ],
  });
  try {
    expect(replay.tick).toBe(0);
    expect(replay.done).toBe(true);
    expect(replay.runtime.settings.read()).toMatchObject({
      values: { speed: 2 },
      revision: 1,
    });
    expect(replay.advance({ steps: 100 })).toBe(0);
    expect(replay.runtime.settings.read().revision).toBe(1);
  } finally {
    replay.stop();
  }
});
