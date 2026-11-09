// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  defineAirJamSimulation,
  SimulationClock,
} from "../src/core/simulation";
import {
  useSimulationFrame,
  useSimulationSelector,
} from "../src/hooks/use-simulation";
import { hostRuntimeContext } from "../src/runtime/runtime-owner-contexts";

const counter = defineAirJamSimulation<{ steps: number }>({
  stepMs: 10,
  create: () => ({ steps: 0 }),
  step: (sim) => {
    sim.steps += 1;
  },
});

describe("useSimulationSelector", () => {
  it("re-renders when the selected value changes and not otherwise", () => {
    const clock = new SimulationClock(
      counter,
      {
        beginStep: () => {},
        input: () => undefined,
        players: () => [],
        reconnectingPlayerIds: () => [],
        runtimeState: () => "playing",
      },
      1,
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <hostRuntimeContext.Provider value={{ simulation: clock }}>
        {children}
      </hostRuntimeContext.Provider>
    );
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useSimulationSelector((sim: { steps: number }) =>
          Math.floor(sim.steps / 10),
        );
      },
      { wrapper },
    );
    expect(result.current).toBe(0);
    const initialRenders = renders;

    act(() => clock.advance(50));
    expect(result.current).toBe(0);
    expect(renders).toBe(initialRenders);

    act(() => clock.advance(60));
    expect(result.current).toBe(1);
  });
});

function Later({ depth, children }: { depth: number; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted ? (
    depth ? (
      <Later depth={depth - 1}>{children}</Later>
    ) : (
      children
    )
  ) : null;
}

it("draws the current paused frame when a deeply deferred renderer subscribes, without advancing time", () => {
  let state: "playing" | "paused" = "playing";
  const clock = new SimulationClock(
    counter,
    {
      beginStep: () => {},
      input: () => undefined,
      players: () => [],
      reconnectingPlayerIds: () => [],
      runtimeState: () => state,
    },
    1,
  );
  clock.advance(755);
  state = "paused";
  const draw = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <hostRuntimeContext.Provider value={{ simulation: clock }}>
      <Later depth={4}>{children}</Later>
    </hostRuntimeContext.Provider>
  );
  const { unmount } = renderHook(() => useSimulationFrame(draw), { wrapper });
  expect(draw).toHaveBeenCalledTimes(1);
  expect(draw.mock.calls[0][0]).toMatchObject({
    tick: 75,
    sim: { steps: 75 },
    alpha: 0.5,
  });
  expect(clock.ticks).toBe(75);
  expect(clock.timeMs).toBe(750);
  unmount();
  act(() => clock.advance(0));
  expect(draw).toHaveBeenCalledTimes(1);
});
