// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHostLobbyShell } from "../src/ui";

describe("useHostLobbyShell", () => {
  it("treats a missing join url as unavailable", () => {
    const { result } = renderHook(() =>
      useHostLobbyShell({
        joinUrl: "",
      }),
    );

    expect(result.current.joinUrlValue).toBe("");
    expect(result.current.hasJoinUrl).toBe(false);
  });

  it("copies the join url and exposes copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    });

    const { result } = renderHook(() =>
      useHostLobbyShell({
        joinUrl: "https://example.com/controller?room=ROOM1",
      }),
    );

    await act(async () => {
      await result.current.handleCopy();
    });

    expect(writeText).toHaveBeenCalledWith(
      "https://example.com/controller?room=ROOM1",
    );
    expect(result.current.copied).toBe(true);
  });

  it("guards the start handler behind canStartMatch", () => {
    const onStartMatch = vi.fn();
    const { result } = renderHook(() =>
      useHostLobbyShell({
        joinUrl: "https://example.com/controller?room=ROOM1",
        canStartMatch: false,
        onStartMatch,
      }),
    );

    act(() => {
      result.current.handleStart();
    });

    expect(onStartMatch).not.toHaveBeenCalled();
  });
});
