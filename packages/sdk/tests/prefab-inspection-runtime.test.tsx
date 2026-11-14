// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import * as canvasCapture from "../src/agent/host-canvas-capture";
import { SocketManager } from "../src/context/socket-manager";
import { HostRuntime } from "../src/core/host-runtime";
import { useHostAgentCapture } from "../src/hooks/use-host-agent-capture";
import { definePrefab } from "../src/prefabs/types";
import { DEFAULT_PREFAB_VIEW } from "../src/prefabs/view";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { prefabInspectionMessageSchema } from "../src/runtime/prefab-inspection-bridge";
import { usePrefabInspection } from "../src/runtime/prefab-inspection-context";
import { AirJamHostRuntime } from "../src/runtime/session-runtimes";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});
it("isolates direct-state inspection, captures two rendered views and then shows the selection sent meanwhile, checking the parent origin", async () => {
  window.history.replaceState(
    {},
    "",
    "/?airjamInspect=1&prefab=dot&state=pulse&time=0.3",
  );
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const parent = frame.contentWindow!;
  const originalParent = window.parent;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  const posted = vi.spyOn(parent, "postMessage").mockImplementation(() => {});
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    frames.push(callback),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const drawn: string[] = [];
  const socket = vi.spyOn(SocketManager.prototype, "getSocket");
  const start = vi.spyOn(HostRuntime.prototype, "start");
  const live = vi.fn(() => null);
  const prefab = definePrefab({
    id: "dot",
    label: "Dot",
    space: "2d",
    category: "actor",
    description: "",
    tags: [],
    defaultProps: {},
    configSchema: z.object({ size: z.number().default(4) }),
    states: [{ id: "pulse", label: "Pulse", seconds: 1, loop: true }],
  });
  vi.spyOn(canvasCapture, "createHostCanvasCapture").mockImplementation(() => ({
    capture: () => {
      drawn.push(result.container.textContent!);
      return { mimeType: "image/jpeg", data: "YQ==", width: 64, height: 64 };
    },
    rendered: () => {},
  }));
  function Stage() {
    const { state, time, props, view } = usePrefabInspection();
    useHostAgentCapture(() => false);
    return <div>{JSON.stringify({ state: state.id, time, props, view })}</div>;
  }
  const Live = live;
  const result = render(
    <AirJamHostRuntime
      prefabs={[prefab]}
      prefabStage={Stage}
      resolveEnv={false}
      topology={resolveRuntimeTopology({
        runtimeMode: "standalone-dev",
        surfaceRole: "host",
        appOrigin: "http://localhost",
        backendOrigin: "http://localhost",
        publicHost: "http://localhost",
        embedded: true,
        embedParentOrigin: "https://studio.test",
      })}
    >
      <Live />
    </AirJamHostRuntime>,
  );
  try {
    expect(JSON.parse(result.container.textContent!)).toMatchObject({
      state: "pulse",
      time: 0.3,
      props: { size: 4 },
    });
    const request = {
      type: "AIRJAM_PREFAB_CAPTURE",
      requestId: "capture",
      views: [
        { stateId: "pulse", time: 0.5, view: DEFAULT_PREFAB_VIEW },
        {
          stateId: "pulse",
          time: 0.9,
          view: { ...DEFAULT_PREFAB_VIEW, zoom: 2 },
        },
      ],
    };
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: parent,
          origin: "https://evil.test",
          data: request,
        }),
      );
    });
    expect(frames).toHaveLength(0);
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: parent,
          origin: "https://studio.test",
          data: request,
        }),
      );
    });
    for (let index = 0; index < 4; index++) {
      await act(async () => {
        frames.shift()!(index * 16);
      });
      if (index === 1)
        await act(async () => {
          window.dispatchEvent(
            new MessageEvent("message", {
              source: parent,
              origin: "https://studio.test",
              data: {
                type: "AIRJAM_PREFAB_SELECT",
                selection: {
                  prefabId: "dot",
                  stateId: "pulse",
                  time: 0.7,
                  playing: false,
                  view: DEFAULT_PREFAB_VIEW,
                },
              },
            }),
          );
        });
    }
    expect(drawn.map((value) => JSON.parse(value).time)).toEqual([0.5, 0.9]);
    expect(JSON.parse(drawn[1]!).view.zoom).toBe(2);
    expect(JSON.parse(result.container.textContent!).time).toBe(0.7);
    const messages = posted.mock.calls.map(([value]) =>
      prefabInspectionMessageSchema.parse(value),
    );
    expect(messages.some((value) => value.type === "AIRJAM_PREFAB_ERROR")).toBe(
      false,
    );
    const captured = messages.find(
      (value) => value.type === "AIRJAM_PREFAB_CAPTURED",
    );
    expect(captured).toMatchObject({
      requestId: "capture",
      images: [
        { time: 0.5, width: 64 },
        { time: 0.9, width: 64 },
      ],
    });
    expect(socket).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
    expect(live).not.toHaveBeenCalled();
  } finally {
    cleanup();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: originalParent,
    });
    frame.remove();
  }
});
