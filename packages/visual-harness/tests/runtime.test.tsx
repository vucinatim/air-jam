import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "../src/bridge-contract";
import { VisualHarnessRuntime } from "../src/runtime";
import {
  VISUAL_HARNESS_ACTIONS_KEY,
  VISUAL_HARNESS_BRIDGE_KEY,
  VISUAL_HARNESS_ENABLE_PARAM,
  VISUAL_HARNESS_ENABLE_VALUE,
  readVisualHarnessBridgeSnapshot,
} from "../src/runtime-bridge";

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
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    delete (window as unknown as Record<string, unknown>)[
      VISUAL_HARNESS_BRIDGE_KEY
    ];
    delete (window as unknown as Record<string, unknown>)[
      VISUAL_HARNESS_ACTIONS_KEY
    ];
  });

  it("publishes snapshots and typed actions", async () => {
    const calls: number[] = [];
    renderHarnessHost({
      enabled: true,
      roomId: "room-1",
      joinUrl: "https://join",
      matchPhase: "lobby",
      runtimeState: "paused",
      points: [1, 2],
      calls,
    });

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
    renderHarnessHost({
      enabled: false,
      roomId: "room-1",
      joinUrl: "https://join",
      matchPhase: "lobby",
      runtimeState: "paused",
      points: [],
      calls: [],
    });

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

    renderHarnessHost({
      roomId: "room-1",
      joinUrl: "https://join",
      matchPhase: "playing",
      runtimeState: "playing",
      points: [],
      calls: [],
    });

    expect(readVisualHarnessBridgeSnapshot(window)).toMatchObject({
      matchPhase: "playing",
      runtimeState: "playing",
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

    view.unmount();

    expect(readVisualHarnessBridgeSnapshot(window)).toBeNull();
    expect(
      (window as unknown as Record<string, unknown>)[
        VISUAL_HARNESS_ACTIONS_KEY
      ],
    ).toBeUndefined();
  });
});
