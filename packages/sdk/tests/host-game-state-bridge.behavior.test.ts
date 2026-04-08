// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHostRuntimeStateBridge } from "../src/hooks/use-host-runtime-state-bridge";

const mocked = vi.hoisted(() => ({
  useAssertSessionScope: vi.fn(),
}));

vi.mock("../src/context/session-scope", () => ({
  useAssertSessionScope: mocked.useAssertSessionScope,
}));

describe("useHostRuntimeStateBridge", () => {
  it("toggles runtime state on active phase transitions", () => {
    const toggleRuntimeState = vi.fn();
    const onEnterActivePhase = vi.fn();
    const onExitActivePhase = vi.fn();
    const onPhaseTransition = vi.fn();

    const { rerender } = renderHook(
      ({
        matchPhase,
        runtimeState,
      }: {
        matchPhase: "lobby" | "countdown" | "playing" | "ended";
        runtimeState: "paused" | "playing";
      }) =>
        useHostRuntimeStateBridge({
          matchPhase,
          runtimeState,
          toggleRuntimeState,
          onEnterActivePhase,
          onExitActivePhase,
          onPhaseTransition,
        }),
      {
        initialProps: {
          matchPhase: "lobby",
          runtimeState: "paused",
        },
      },
    );

    rerender({
      matchPhase: "countdown",
      runtimeState: "paused",
    });

    expect(toggleRuntimeState).toHaveBeenCalledTimes(1);
    expect(onEnterActivePhase).toHaveBeenCalledTimes(1);
    expect(onExitActivePhase).not.toHaveBeenCalled();

    rerender({
      matchPhase: "ended",
      runtimeState: "playing",
    });

    expect(toggleRuntimeState).toHaveBeenCalledTimes(2);
    expect(onExitActivePhase).toHaveBeenCalledTimes(1);
    expect(onPhaseTransition).toHaveBeenCalledTimes(2);
  });

  it("does not toggle if host runtime state is already aligned", () => {
    const toggleRuntimeState = vi.fn();

    const { rerender } = renderHook(
      ({
        matchPhase,
        runtimeState,
      }: {
        matchPhase: "lobby" | "countdown";
        runtimeState: "paused" | "playing";
      }) =>
        useHostRuntimeStateBridge({
          matchPhase,
          runtimeState,
          toggleRuntimeState,
        }),
      {
        initialProps: {
          matchPhase: "lobby",
          runtimeState: "paused",
        },
      },
    );

    rerender({
      matchPhase: "countdown",
      runtimeState: "playing",
    });
    rerender({
      matchPhase: "lobby",
      runtimeState: "paused",
    });

    expect(toggleRuntimeState).not.toHaveBeenCalled();
  });
});
