// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePreviewControllerManager } from "../src/preview";

describe("usePreviewControllerManager", () => {
  it("spawns preview sessions and marks the first one expanded", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.expanded).toBe(true);
    expect(result.current.sessions[0]?.surfaceState).toBe("loading");
  });

  it("enforces the max preview-controller count", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
        maxControllers: 2,
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
      result.current.spawnPreviewController();
      result.current.spawnPreviewController();
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.canSpawn).toBe(false);
  });

  it("supports focus and surface state updates", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
      result.current.spawnPreviewController();
    });

    const firstSessionId = result.current.sessions[0]!.id;

    act(() => {
      result.current.focusPreviewController(firstSessionId);
      result.current.markPreviewControllerReady(firstSessionId);
    });

    expect(result.current.sessions.at(-1)?.id).toBe(firstSessionId);
    expect(
      result.current.sessions.find((session) => session.id === firstSessionId)
        ?.surfaceState,
    ).toBe("ready");
  });

  it("clears sessions when the join url changes", () => {
    const { result, rerender } = renderHook(
      ({ joinUrl }: { joinUrl: string | null }) =>
        usePreviewControllerManager({
          joinUrl,
        }),
      {
        initialProps: {
          joinUrl: "https://platform.example/controller?room=ROOM1",
        },
      },
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    expect(result.current.sessions).toHaveLength(1);

    rerender({
      joinUrl: "https://platform.example/controller?room=ROOM2",
    });

    expect(result.current.sessions).toHaveLength(0);
  });
});
