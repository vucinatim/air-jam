// Runs in plain Node: the simulation clock needs no browser to advance.
import { describe, expect, it } from "vitest";
import {
  createSeededRandom,
  defineAirJamSimulation,
  SimulationClock,
} from "../src/core";

const walker = defineAirJamSimulation<
  { x: number; steps: number; path: number[] },
  { direction: number },
  { type: "edge" }
>({
  stepMs: 10,
  create: () => ({ x: 0, steps: 0, path: [] }),
  step: (sim, { input, random, emit, dtSeconds }) => {
    sim.steps += 1;
    sim.x += input("p1").direction * dtSeconds + random();
    sim.path.push(sim.x);
    if (sim.x > 2) emit({ type: "edge" });
  },
});

const room = (direction: number) => ({
  beginStep: () => {},
  input: () => ({ direction }),
  players: () => [],
  runtimeState: () => "playing" as const,
});

describe("simulation clock", () => {
  it("runs whole fixed steps for any amount of game time", () => {
    const clock = new SimulationClock(walker, room(0), 7);
    clock.advance(25);
    expect(clock.sim.steps).toBe(2);
    clock.advance(5);
    expect(clock.sim.steps).toBe(3);
    clock.advance(10_000);
    expect(clock.ticks).toBe(1003);
  });

  it("replays the same game from the same seed and inputs", () => {
    const first = new SimulationClock(walker, room(1), 42);
    const second = new SimulationClock(walker, room(1), 42);
    const other = new SimulationClock(walker, room(1), 43);
    first.advance(500);
    second.advance(500);
    other.advance(500);
    expect(second.sim.path).toEqual(first.sim.path);
    expect(other.sim.path).not.toEqual(first.sim.path);
    expect(createSeededRandom(42)()).toBe(createSeededRandom(42)());
  });

  it("reports events and frames with the drawing position between steps", () => {
    const clock = new SimulationClock(walker, room(100), 1);
    const events: string[] = [];
    const alphas: number[] = [];
    clock.onEvent((event) => events.push(event.type));
    clock.onFrame((frame) => alphas.push(frame.alpha));
    clock.advance(35);
    expect(events.length).toBeGreaterThan(0);
    expect(alphas.at(-1)).toBeCloseTo(0.5);
  });

  it("drops steps a slow real-time frame cannot run instead of spiralling", () => {
    const clock = new SimulationClock(walker, room(0), 1);
    clock.frame(0);
    clock.frame(1_000);
    expect(clock.ticks).toBe(5);
    expect(clock.pace).toMatchObject({
      frames: 2,
      wallMs: 1_000,
      simulatedMs: 50,
    });
  });

  it("keeps game time still while the room is paused and resumes without the gap", () => {
    let runtimeState: "playing" | "paused" = "playing";
    const clock = new SimulationClock(
      walker,
      { ...room(0), runtimeState: () => runtimeState },
      1,
    );
    const frames: number[] = [];
    clock.onFrame((frame) => frames.push(frame.tick));
    clock.frame(0);
    clock.frame(30);
    expect(clock.ticks).toBe(3);

    runtimeState = "paused";
    clock.frame(40);
    clock.frame(5_000);
    clock.advance(1_000);
    expect(clock.ticks).toBe(3);
    expect(clock.timeMs).toBe(30);
    expect(frames).toHaveLength(5);

    runtimeState = "playing";
    clock.frame(5_010);
    expect(clock.ticks).toBe(3);
    clock.frame(5_030);
    expect(clock.ticks).toBe(5);
  });
});
