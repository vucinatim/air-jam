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
import { useAirJamHost } from "../src/hooks/use-air-jam-host";
import { useSendSignal } from "../src/hooks/use-send-signal";
import { useSimulationFrame } from "../src/hooks/use-simulation";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { ConnectedRuntimeErrorBoundary } from "../src/runtime/connected-runtime-error-boundary";
import { getHostRealtimeClient } from "../src/runtime/host-realtime-client";
import { AirJamHostRuntime } from "../src/runtime/session-runtimes";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});
it("renders the replay's contexts and installs drawing before answering open, without opening a live socket", async () => {
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
    useSimulationFrame(draw);
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
  try {
    render(
      <AirJamHostRuntime
        topology={topology}
        resolveEnv={false}
        agent={agent}
        simulation={{ stepMs: 10, create: () => ({}), step: () => {} }}
      >
        <ConnectedRuntimeErrorBoundary role="host">
          <AudioRuntime manifest={manifest}>
            <Game />
          </AudioRuntime>
        </ConnectedRuntimeErrorBoundary>
      </AirJamHostRuntime>,
    );
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
    await send("open", {
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
            ([data]) => data.requestId === "open" && data.result?.ok,
          ),
        ).toBe(true),
      { interval: 1 },
    );
    expect(seen).toHaveBeenLastCalledWith("REPLAY");
    expect(draw).toHaveBeenCalledTimes(1);
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
    expect(socket).not.toHaveBeenCalled();
  } finally {
    cleanup();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: originalParent,
    });
    frame.remove();
  }
});
