// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LifecycleActionGroup } from "../src/components/lifecycle-action-group";

describe("LifecycleActionGroup", () => {
  it("renders only the lobby start action when phase is lobby", () => {
    render(
      <LifecycleActionGroup
        phase="lobby"
        onStart={() => undefined}
        startLabel="Play"
      />,
    );

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to Lobby" })).toBeNull();
  });

  it("renders resume and lobby actions for a paused playing state", () => {
    const onTogglePause = vi.fn();
    const onBackToLobby = vi.fn();

    render(
      <LifecycleActionGroup
        phase="playing"
        runtimeState="paused"
        onTogglePause={onTogglePause}
        onBackToLobby={onBackToLobby}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Lobby" }));

    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(onBackToLobby).toHaveBeenCalledTimes(1);
  });

  it("renders restart and lobby actions for the ended phase", () => {
    render(
      <LifecycleActionGroup
        phase="ended"
        onRestart={() => undefined}
        onBackToLobby={() => undefined}
        restartLabel="Play Again"
      />,
    );

    expect(screen.getByRole("button", { name: "Play Again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to Lobby" })).toBeTruthy();
  });
});
