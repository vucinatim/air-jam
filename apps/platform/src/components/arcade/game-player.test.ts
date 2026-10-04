// @vitest-environment jsdom

import type { AirJamRealtimeClient } from "@air-jam/sdk/arcade/bridge/host";
import { createHostBridgeResponseMessage } from "@air-jam/sdk/arcade/bridge/host";
import { resolveRuntimeTopology } from "@air-jam/sdk/runtime-topology";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { GamePlayer } from "./game-player";

vi.mock("@air-jam/sdk", () => ({
  useInheritedPlatformSettings: () => ({}),
}));
vi.mock("@air-jam/sdk/arcade/bridge/iframe", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  emitAirJamDevRuntimeEvent: vi.fn(),
  createParentPlatformSettingsBridge: () => ({
    updateSettings: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    handleMessage: vi.fn(),
  }),
}));

it("round-trips the socket action acknowledgement through the embedded host", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = {
    connected: true,
    id: "host-socket",
    on: vi.fn((name, callback) => handlers.set(name, callback)),
    off: vi.fn(),
    emit: vi.fn((_name, _payload, callback) => callback?.({ ok: true })),
  };
  const port = {
    start: vi.fn(),
    close: vi.fn(),
    postMessage: vi.fn(),
    onmessage: null as ((event: { data: unknown }) => void) | null,
  };
  const surface = { kind: "game" as const, epoch: 1, gameId: "pong" };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        createElement(GamePlayer, {
          game: {
            id: "pong",
            name: "Pong",
            url: "https://game.test/host",
            controllerUrl: "https://game.test/controller",
          },
          normalizedUrl: "https://game.test/host",
          launchCapability: {
            token: "launch-token",
            expiresAt: Date.now() + 10000,
          },
          roomId: "ABCD",
          hostSocket: socket as unknown as AirJamRealtimeClient,
          players: [],
          runtimeState: "playing",
          isVisible: true,
          arcadeSurfaceRuntimeIdentity: surface,
          onExit: vi.fn(),
          parentTopology: resolveRuntimeTopology({
            runtimeMode: "arcade-live",
            surfaceRole: "host",
            appOrigin: "https://airjam.test",
            backendOrigin: "https://airjam.test",
            publicHost: "https://airjam.test",
            assetBasePath: "/",
            secureTransport: true,
            embedded: false,
            proxyStrategy: "none",
          }),
        }),
      ),
    );
    const iframe = container.querySelector("iframe")!;
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          source: iframe.contentWindow,
          origin: "https://game.test",
          ports: [port as unknown as MessagePort],
          data: {
            type: "AIRJAM_HOST_BRIDGE_REQUEST",
            payload: {
              handshake: {
                protocolVersion: "2",
                sdkVersion: "1.0.0",
                runtimeKind: "arcade-host-iframe",
                capabilityFlags: { hostBridge: true },
              },
              roomId: "ABCD",
              capabilityToken: "launch-token",
              arcadeSurface: surface,
            },
          },
        }),
      ),
    );
    expect(port.onmessage).not.toBeNull();
    port.postMessage.mockClear();
    const payload = {
      roomId: "ABCD",
      storeDomain: "default",
      actionName: "joinTeam",
      payload: { team: "team1" },
    };
    const acknowledge = vi.fn();
    handlers.get("airjam:action_rpc")!(payload, acknowledge);
    const message = port.postMessage.mock.calls[0][0];
    expect(message.payload.args).toEqual([payload]);
    expect(message.payload.requestId).toEqual(expect.any(String));
    const ack = { ok: true, status: "accepted", source: "host" };
    port.onmessage!({
      data: createHostBridgeResponseMessage(message.payload.requestId, ack),
    });
    expect(acknowledge).toHaveBeenCalledExactlyOnceWith(ack);
    // A repeated response cannot complete the original socket callback twice.
    port.onmessage!({
      data: createHostBridgeResponseMessage(message.payload.requestId, ack),
    });
    expect(acknowledge).toHaveBeenCalledTimes(1);
    port.postMessage.mockClear();
    handlers.get("airjam:action_rpc")!(payload);
    expect(port.postMessage.mock.calls[0][0].payload).toEqual({
      event: "airjam:action_rpc",
      args: [payload],
    });
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
