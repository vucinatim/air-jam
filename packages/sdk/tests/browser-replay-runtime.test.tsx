// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { defineAirJamAgentContract } from "../src/agent/agent-contract";
import {
  AudioRuntime,
  useAudio,
  useAudioRuntimeStatus,
} from "../src/audio/hooks";
import { useAirJamContext } from "../src/context/air-jam-context";
import { SocketManager } from "../src/context/socket-manager";
import { HostRuntime } from "../src/core/host-runtime";
import { defineAirJamSimulation } from "../src/core/simulation";
import { useAirJamHost } from "../src/hooks/use-air-jam-host";
import { useHostAgentCapture } from "../src/hooks/use-host-agent-capture";
import { useSendSignal } from "../src/hooks/use-send-signal";
import { useSimulationFrame } from "../src/hooks/use-simulation";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { ConnectedRuntimeErrorBoundary } from "../src/runtime/connected-runtime-error-boundary";
import * as hostObservation from "../src/runtime/host-observation";
import { getHostRealtimeClient } from "../src/runtime/host-realtime-client";
import { AirJamHostRuntime } from "../src/runtime/session-runtimes";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

it.each([false, true])(
  "renders a paused replay through audio providers, with capture ready before reading (scrub back=%s)",
  async (scrubBack) => {
    window.history.replaceState({}, "", "/?airjamReplay=1");
    const originalParent = window.parent;
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const parent = frame.contentWindow!;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parent,
    });
    const posted = vi.spyOn(parent, "postMessage").mockImplementation(() => {});
    const socket = vi.spyOn(SocketManager.prototype, "getSocket");
    const draw = vi.fn();
    let captureReady = false;
    const captureAtRead: boolean[] = [];
    const drawnAtRead: number[] = [];
    const actualStart = HostRuntime.prototype.start;
    vi.spyOn(HostRuntime.prototype, "start").mockImplementation(function (
      this: HostRuntime,
    ) {
      const setCapture = this.setObservationCapture;
      vi.spyOn(this, "setObservationCapture").mockImplementation((capture) => {
        captureReady = capture !== null;
        setCapture(capture);
      });
      return actualStart.call(this);
    });
    const observe = hostObservation.observeHostRuntime;
    vi.spyOn(hostObservation, "observeHostRuntime").mockImplementation(
      (...args) => {
        captureAtRead.push(captureReady);
        drawnAtRead.push(draw.mock.calls.length);
        return observe(...args);
      },
    );
    const seen = vi.fn();
    const manifest = {};
    function Game() {
      const host = useAirJamHost();
      const { getSocket } = useAirJamContext();
      const sendSignal = useSendSignal();
      useAudio();
      useAudioRuntimeStatus();
      expect(getSocket("host")).toBe(host.socket);
      expect(getHostRealtimeClient(getSocket)).toBe(host.socket);
      useEffect(() => {
        sendSignal("TOAST", { title: "Replayed" });
      }, [sendSignal]);
      seen(host.roomId);
      useSimulationFrame<{ x: number }>((frame) =>
        draw({ tick: frame.tick, x: frame.sim.x, alpha: frame.alpha }),
      );
      useHostAgentCapture(() => false);
      return <div>{host.roomId}</div>;
    }
    const agent = defineAirJamAgentContract({
      stores: {},
      actions: {},
      projectSnapshot: () => ({}),
    });
    const topology = resolveRuntimeTopology({
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: "http://localhost",
      backendOrigin: "http://localhost",
      publicHost: "http://localhost",
      embedded: true,
      embedParentOrigin: "https://studio.test",
    });
    const simulation = defineAirJamSimulation({
      stepMs: 10,
      create: () => ({ x: 0 }),
      step: (sim) => {
        sim.x += 1;
      },
      observe: (sim) => ({ x: sim.x }),
    });
    const mount = () =>
      render(
        <AirJamHostRuntime
          topology={topology}
          resolveEnv={false}
          agent={agent}
          simulation={simulation}
        >
          <ConnectedRuntimeErrorBoundary role="host">
            <AudioRuntime manifest={manifest}>
              <Game />
            </AudioRuntime>
          </ConnectedRuntimeErrorBoundary>
        </AirJamHostRuntime>,
      );
    try {
      let view = mount();
      expect(socket).not.toHaveBeenCalled();
      expect(seen).not.toHaveBeenCalled();
      const send = async (requestId: string, request: unknown) =>
        act(async () => {
          window.dispatchEvent(
            new MessageEvent("message", {
              source: parent,
              origin: "https://studio.test",
              data: { type: "AIRJAM_REPLAY", requestId, request },
            }),
          );
        });
      const open = async (requestId: string) => {
        await send(requestId, {
          operation: "open",
          log: {
            version: 2,
            seed: 1,
            settings: {},
            stepMs: 10,
            ticks: 100,
            storeDomain: "default",
            entries: [],
          },
        });
        await vi.waitFor(
          () =>
            expect(
              posted.mock.calls.some(
                ([data]) => data.requestId === requestId && data.result?.ok,
              ),
            ).toBe(true),
          { interval: 1 },
        );
      };
      await open("open");
      expect(seen).toHaveBeenLastCalledWith("REPLAY");
      expect(draw).toHaveBeenCalledTimes(1);
      expect(draw.mock.calls[0][0]).toMatchObject({ tick: 0, x: 0 });
      expect(captureAtRead).toEqual([true]);
      expect(drawnAtRead).toEqual([1]);
      draw.mockClear();
      await send("jump", { operation: "advance", by: { toTick: 75 } });
      await vi.waitFor(
        () =>
          expect(
            posted.mock.calls.some(
              ([data]) => data.requestId === "jump" && data.result?.ok,
            ),
          ).toBe(true),
        { interval: 1 },
      );
      expect(draw).toHaveBeenCalledTimes(1);
      expect(draw.mock.calls[0][0].tick).toBe(75);
      expect(draw.mock.calls[0][0].x).toBe(75);
      if (scrubBack) {
        view.unmount();
        draw.mockClear();
        view = mount();
        await open("reopen");
        expect(draw).toHaveBeenCalledTimes(1);
        expect(draw.mock.calls[0][0]).toMatchObject({ tick: 0, x: 0 });
        draw.mockClear();
        await send("back", { operation: "advance", by: { toTick: 25 } });
        expect(draw).toHaveBeenCalledTimes(1);
        expect(draw.mock.calls[0][0]).toMatchObject({ tick: 25, x: 25 });
        await send("read", { operation: "read" });
        expect(draw).toHaveBeenCalledTimes(1);
        const read = posted.mock.calls.find(
          ([data]) => data.requestId === "read",
        )?.[0];
        expect(read.result.response).toMatchObject({
          tick: 25,
          observation: { ticks: { after: 25 }, runtime: { x: 25 } },
        });
      }
      expect(captureAtRead.every(Boolean)).toBe(true);
      expect(socket).not.toHaveBeenCalled();
    } finally {
      cleanup();
      Object.defineProperty(window, "parent", {
        configurable: true,
        value: originalParent,
      });
      frame.remove();
    }
  },
);
