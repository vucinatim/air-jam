// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePreviewControllerManager } from "../src/preview";

describe("usePreviewControllerManager", () => {
  it("spawns preview sessions as active floating windows", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessions[0]?.minimized).toBe(false);
    expect(result.current.sessions[0]?.active).toBe(true);
    expect(result.current.sessions[0]?.surfaceState).toBe("loading");
    expect(result.current.sessions[0]?.x).toBeTypeOf("number");
    expect(result.current.sessions[0]?.y).toBeTypeOf("number");
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

  it("supports focus, minimize, restore, and surface state updates", () => {
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
    const secondSessionId = result.current.sessions[1]!.id;

    act(() => {
      result.current.focusPreviewController(firstSessionId);
      result.current.minimizePreviewController(firstSessionId);
      result.current.restorePreviewController(firstSessionId);
      result.current.markPreviewControllerReady(firstSessionId);
    });

    const firstSession = result.current.sessions.find(
      (session) => session.id === firstSessionId,
    );
    const secondSession = result.current.sessions.find(
      (session) => session.id === secondSessionId,
    );

    expect(firstSession?.active).toBe(true);
    expect(firstSession?.minimized).toBe(false);
    expect(firstSession?.surfaceState).toBe("ready");
    expect(firstSession?.zIndex).toBeGreaterThan(secondSession?.zIndex ?? 0);
    expect(secondSession?.active).toBe(false);
  });

  it("gives concurrent preview sessions distinct controller and device identities", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
        maxControllers: 2,
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
      result.current.spawnPreviewController();
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessions[0]?.controllerId).not.toBe(
      result.current.sessions[1]?.controllerId,
    );
    expect(result.current.sessions[0]?.deviceId).not.toBe(
      result.current.sessions[1]?.deviceId,
    );
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

  it("keeps preview sessions when the join url changes inside the same room", () => {
    const { result, rerender } = renderHook(
      ({ joinUrl }: { joinUrl: string | null }) =>
        usePreviewControllerManager({
          joinUrl,
        }),
      {
        initialProps: {
          joinUrl: "https://platform.example/controller?room=ROOM1&cap=one",
        },
      },
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    expect(result.current.sessions).toHaveLength(1);

    rerender({
      joinUrl: "https://platform.example/controller?room=ROOM1&cap=two",
    });

    expect(result.current.sessions).toHaveLength(1);
  });

  it("keeps preview sessions when the join url becomes temporarily unavailable", () => {
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
      joinUrl: null,
    });

    expect(result.current.sessions).toHaveLength(1);
  });

  it("updates preview-controller position", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    const sessionId = result.current.sessions[0]!.id;
    const initialPosition = {
      x: result.current.sessions[0]!.x,
      y: result.current.sessions[0]!.y,
    };

    act(() => {
      result.current.setPreviewControllerPosition(
        sessionId,
        initialPosition.x - 80,
        initialPosition.y - 40,
      );
    });

    expect(result.current.sessions[0]!.x).not.toBe(initialPosition.x);
    expect(result.current.sessions[0]!.y).not.toBe(initialPosition.y);
  });
});
