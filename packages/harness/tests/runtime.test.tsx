import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "../src/core/bridge-contract";
import {
  VISUAL_HARNESS_ACTIONS_KEY,
  VISUAL_HARNESS_BRIDGE_KEY,
  VISUAL_HARNESS_ENABLE_PARAM,
  VISUAL_HARNESS_ENABLE_VALUE,
  readVisualHarnessBridgeSnapshot,
} from "../src/core/runtime-bridge";
import { VisualHarnessRuntime } from "../src/runtime";

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const bridge = defineVisualHarnessBridge({
  gameId: "pong",
  selectSnapshot: (context: {
    roomId: string;
    joinUrl: string | null;
    matchPhase: string;
    runtimeState: string;
    points: number[];
    calls: number[];
  }) => ({
    roomId: context.roomId,
    controllerJoinUrl: context.joinUrl,
    matchPhase: context.matchPhase,
    runtimeState: context.runtimeState,
    points: context.points,
  }),
  actions: {
    setPointsToWin: bridgeAction.number(
      (
        context: {
          calls: number[];
        },
        pointsToWin,
      ) => {
        context.calls.push(pointsToWin);
        return pointsToWin;
      },
    ),
  },
});

const activeViews: Array<{ unmount: () => void }> = [];

const HarnessHost = (props: {
  enabled?: boolean;
  roomId: string;
  joinUrl: string | null;
  matchPhase: string;
  runtimeState: string;
  points: number[];
  calls: number[];
}) => {
  return (
    <VisualHarnessRuntime
      bridge={bridge}
      context={{
        roomId: props.roomId,
        joinUrl: props.joinUrl,
        matchPhase: props.matchPhase,
        runtimeState: props.runtimeState,
        points: props.points,
        calls: props.calls,
      }}
      enabled={props.enabled}
    />
  );
};

const renderHarnessHost = (props: ComponentProps<typeof HarnessHost>) => {
  const container = document.createElement("div");
  const root: Root = createRoot(container);

  act(() => {
    root.render(<HarnessHost {...props} />);
  });

  return {
    rerender: (nextProps: ComponentProps<typeof HarnessHost>) => {
      act(() => {
        root.render(<HarnessHost {...nextProps} />);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
};

describe("VisualHarnessRuntime", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const href = String(input);
        if (href.endsWith("/__airjam/dev/harness/register")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (href.includes("/__airjam/dev/harness/commands")) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return new Response(null, { status: 204 });
        }

        return new Response(null, { status: 404 });
      },
    ) as typeof fetch;
  });

  afterEach(() => {
    while (activeViews.length > 0) {
      activeViews.pop()?.unmount();
    }
    window.history.replaceState(null, "", "/");
    delete (window as unknown as Record<string, unknown>)[
      VISUAL_HARNESS_BRIDGE_KEY
    ];
    delete (window as unknown as Record<string, unknown>)[
      VISUAL_HARNESS_ACTIONS_KEY
    ];
    globalThis.fetch = originalFetch;
  });

  it("publishes snapshots and typed actions", async () => {
    const calls: number[] = [];
    activeViews.push(
      renderHarnessHost({
        enabled: true,
        roomId: "room-1",
        joinUrl: "https://join",
        matchPhase: "lobby",
        runtimeState: "paused",
        points: [1, 2],
        calls,
      }),
    );

    expect(readVisualHarnessBridgeSnapshot(window)).toMatchObject({
      roomId: "room-1",
      controllerJoinUrl: "https://join",
      matchPhase: "lobby",
      runtimeState: "paused",
      points: [1, 2],
    });

    const actions = (
      window as unknown as Record<
        string,
        Record<string, (payload?: unknown) => Promise<unknown>>
      >
    )[VISUAL_HARNESS_ACTIONS_KEY];
    await expect(actions.setPointsToWin("5")).resolves.toBe(5);
    expect(calls).toEqual([5]);
  });

  it("updates the published snapshot when host context changes", () => {
    const calls: number[] = [];
    const view = renderHarnessHost({
      enabled: true,
      roomId: "room-1",
      joinUrl: "https://join",
      matchPhase: "lobby",
      runtimeState: "paused",
      points: [1],
      calls,
    });
    activeViews.push(view);

    view.rerender({
      enabled: true,
      roomId: "room-1",
      joinUrl: "https://join",
      matchPhase: "playing",
      runtimeState: "playing",
      points: [3],
      calls,
    });

    expect(readVisualHarnessBridgeSnapshot(window)).toMatchObject({
      matchPhase: "playing",
      runtimeState: "playing",
      points: [3],
    });
  });

  it("does not publish bridge state when disabled", () => {
    activeViews.push(
      renderHarnessHost({
        enabled: false,
        roomId: "room-1",
        joinUrl: "https://join",
        matchPhase: "lobby",
        runtimeState: "paused",
        points: [],
        calls: [],
      }),
    );

    expect(readVisualHarnessBridgeSnapshot(window)).toBeNull();
    expect(
      (window as unknown as Record<string, unknown>)[
        VISUAL_HARNESS_ACTIONS_KEY
      ],
    ).toBeUndefined();
  });

  it("publishes bridge state when the URL explicitly enables the harness", () => {
    window.history.replaceState(
      null,
      "",
      `/?${VISUAL_HARNESS_ENABLE_PARAM}=${VISUAL_HARNESS_ENABLE_VALUE}`,
    );

    activeViews.push(
      renderHarnessHost({
        roomId: "room-1",
        joinUrl: "https://join",
        matchPhase: "playing",
        runtimeState: "playing",
        points: [],
        calls: [],
      }),
    );

    expect(readVisualHarnessBridgeSnapshot(window)).toMatchObject({
      matchPhase: "playing",
      runtimeState: "playing",
    });
  });

  it("registers the live harness session with the local dev broker", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const href = String(input);
        if (href.endsWith("/__airjam/dev/harness/register")) {
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (href.includes("/__airjam/dev/harness/commands")) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected fetch ${href}`);
      },
    );
    globalThis.fetch = fetchMock as typeof fetch;

    activeViews.push(
      renderHarnessHost({
        enabled: true,
        roomId: "ROOM1",
        joinUrl: "https://join",
        matchPhase: "lobby",
        runtimeState: "playing",
        points: [],
        calls: [],
      }),
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/__airjam/dev/harness/register"),
      expect.objectContaining({
        method: "POST",
      }),
    );

    const registerCall = fetchMock.mock.calls.find(([input]) =>
      String(input).endsWith("/__airjam/dev/harness/register"),
    );
    const registerInit =
      registerCall && registerCall.length > 1
        ? (registerCall[1] as RequestInit | undefined)
        : undefined;
    const body = JSON.parse(String(registerInit?.body ?? "{}"));
    expect(body).toMatchObject({
      gameId: "pong",
      role: "host",
      roomId: "ROOM1",
      actions: [
        {
          name: "setPointsToWin",
          payload: {
            kind: "number",
          },
        },
      ],
    });
  });

  it("cleans up the published bridge state on unmount", () => {
    const view = renderHarnessHost({
      enabled: true,
      roomId: "room-1",
      joinUrl: "https://join",
      matchPhase: "lobby",
      runtimeState: "paused",
      points: [],
      calls: [],
    });
    activeViews.push(view);

    view.unmount();

    expect(readVisualHarnessBridgeSnapshot(window)).toBeNull();
    expect(
      (window as unknown as Record<string, unknown>)[
        VISUAL_HARNESS_ACTIONS_KEY
      ],
    ).toBeUndefined();
  });
});
