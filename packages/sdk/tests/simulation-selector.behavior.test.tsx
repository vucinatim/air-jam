// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  defineAirJamSimulation,
  SimulationClock,
} from "../src/core/simulation";
import { useSimulationSelector } from "../src/hooks/use-simulation";
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
        input: () => undefined,
        players: () => [],
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
