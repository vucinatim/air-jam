// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getResizedPreviewBounds } from "../src/preview/layout";
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
    expect(result.current.sessions[0]?.width).toBeTypeOf("number");
    expect(result.current.sessions[0]?.height).toBeTypeOf("number");
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

  it("updates preview-controller bounds and keeps them clamped", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    const sessionId = result.current.sessions[0]!.id;
    const initialSize = {
      x: result.current.sessions[0]!.x,
      y: result.current.sessions[0]!.y,
      width: result.current.sessions[0]!.width,
      height: result.current.sessions[0]!.height,
    };

    act(() => {
      result.current.setPreviewControllerBounds(sessionId, {
        x: initialSize.x,
        y: initialSize.y,
        width: 40,
        height: 20,
      });
    });

    expect(result.current.sessions[0]!.width).toBeGreaterThanOrEqual(260);
    expect(result.current.sessions[0]!.height).toBeGreaterThanOrEqual(440);

    act(() => {
      result.current.setPreviewControllerBounds(sessionId, {
        x: initialSize.x - 120,
        y: initialSize.y - 120,
        width: initialSize.width + 120,
        height: initialSize.height + 120,
      });
    });

    expect(result.current.sessions[0]!.width).toBeGreaterThan(initialSize.width);
    expect(result.current.sessions[0]!.height).toBeGreaterThan(initialSize.height);
    expect(result.current.sessions[0]!.x).toBeLessThanOrEqual(initialSize.x);
    expect(result.current.sessions[0]!.y).toBeLessThanOrEqual(initialSize.y);
  });

  it("keeps the dragged edge fixed when bounds are clamped", () => {
    const { result } = renderHook(() =>
      usePreviewControllerManager({
        joinUrl: "https://platform.example/controller?room=ROOM1",
      }),
    );

    act(() => {
      result.current.spawnPreviewController();
    });

    const sessionId = result.current.sessions[0]!.id;
    act(() => {
      result.current.setPreviewControllerPosition(sessionId, 100, 100);
    });

    const initialBounds = {
      x: result.current.sessions[0]!.x,
      y: result.current.sessions[0]!.y,
      width: result.current.sessions[0]!.width,
      height: result.current.sessions[0]!.height,
    };

    act(() => {
      result.current.setPreviewControllerBounds(
        sessionId,
        {
          x: initialBounds.x,
          y: initialBounds.y,
          width: initialBounds.width + 10_000,
          height: initialBounds.height,
        },
        {
          preserveRight: false,
        },
      );
    });

    expect(result.current.sessions[0]!.x).toBe(initialBounds.x);

    const clampedRightEdge = initialBounds.x + 250 + 30;
    act(() => {
      result.current.setPreviewControllerBounds(
        sessionId,
        {
          x: initialBounds.x + 250,
          y: initialBounds.y,
          width: 30,
          height: initialBounds.height,
        },
        {
          preserveRight: true,
        },
      );
    });

    expect(
      result.current.sessions[0]!.x + result.current.sessions[0]!.width,
    ).toBe(clampedRightEdge);
  });

  it("resizes preview bounds from anchored edges and corners", () => {
    const origin = {
      x: 300,
      y: 200,
      width: 312,
      height: 554,
    };

    expect(getResizedPreviewBounds(origin, "w", -40, 0)).toEqual({
      x: 260,
      y: 200,
      width: 352,
      height: 554,
    });

    expect(getResizedPreviewBounds(origin, "n", 0, -30)).toEqual({
      x: 300,
      y: 170,
      width: 312,
      height: 584,
    });

    expect(getResizedPreviewBounds(origin, "sw", -25, 35)).toEqual({
      x: 275,
      y: 200,
      width: 337,
      height: 589,
    });
  });
});
