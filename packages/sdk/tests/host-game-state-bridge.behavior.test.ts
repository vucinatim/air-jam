// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHostGameStateBridge } from "../src/hooks/use-host-game-state-bridge";

const mocked = vi.hoisted(() => ({
  useAssertSessionScope: vi.fn(),
}));

vi.mock("../src/context/session-providers", () => ({
  useAssertSessionScope: mocked.useAssertSessionScope,
}));

describe("useHostGameStateBridge", () => {
  it("toggles runtime game state on playing phase transitions", () => {
    const toggleGameState = vi.fn();
    const onEnterPlayingPhase = vi.fn();
    const onExitPlayingPhase = vi.fn();
    const onPhaseTransition = vi.fn();

    const { rerender } = renderHook(
      ({
        phase,
        gameState,
      }: {
        phase: "lobby" | "playing" | "ended";
        gameState: "paused" | "playing";
      }) =>
        useHostGameStateBridge({
          phase,
          playingPhase: "playing",
          gameState,
          toggleGameState,
          onEnterPlayingPhase,
          onExitPlayingPhase,
          onPhaseTransition,
        }),
      {
        initialProps: {
          phase: "lobby",
          gameState: "paused",
        },
      },
    );

    rerender({
      phase: "playing",
      gameState: "paused",
    });

    expect(toggleGameState).toHaveBeenCalledTimes(1);
    expect(onEnterPlayingPhase).toHaveBeenCalledTimes(1);
    expect(onExitPlayingPhase).not.toHaveBeenCalled();

    rerender({
      phase: "ended",
      gameState: "playing",
    });

    expect(toggleGameState).toHaveBeenCalledTimes(2);
    expect(onExitPlayingPhase).toHaveBeenCalledTimes(1);
    expect(onPhaseTransition).toHaveBeenCalledTimes(2);
  });

  it("does not toggle if host runtime state is already aligned", () => {
    const toggleGameState = vi.fn();

    const { rerender } = renderHook(
      ({
        phase,
        gameState,
      }: {
        phase: "lobby" | "playing";
        gameState: "paused" | "playing";
      }) =>
        useHostGameStateBridge({
          phase,
          playingPhase: "playing",
          gameState,
          toggleGameState,
        }),
      {
        initialProps: {
          phase: "lobby",
          gameState: "paused",
        },
      },
    );

    rerender({
      phase: "playing",
      gameState: "playing",
    });
    rerender({
      phase: "lobby",
      gameState: "paused",
    });

    expect(toggleGameState).not.toHaveBeenCalled();
  });
});
