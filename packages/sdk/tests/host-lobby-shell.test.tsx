// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHostLobbyShell } from "../src/ui";

describe("useHostLobbyShell", () => {
  it("derives a fallback join url from room id when joinUrl is missing", () => {
    const { result } = renderHook(() =>
      useHostLobbyShell({
        roomId: "ROOM1",
        joinUrl: "",
      }),
    );

    expect(result.current.joinUrlValue).toContain("/controller?room=ROOM1");
    expect(result.current.hasJoinUrl).toBe(true);
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
        roomId: "ROOM1",
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
        roomId: "ROOM1",
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
