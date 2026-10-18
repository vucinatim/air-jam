// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveProjectRuntimeTopology } from "../src/runtime-topology";
import { createHostRuntimeInspectionContract } from "../src/runtime/contracts/inspection";
import {
  publishEmbeddedHostObservation,
  readHostObservation,
  requestHostObservation,
} from "../src/runtime/host-observation-bridge";
import { observationFixture } from "./fixtures/host-observation";

const originalParent = window.parent;
afterEach(() => {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: originalParent,
  });
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "",
  });
});

function bridgeFixture() {
  const parent = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  Object.defineProperty(document, "referrer", {
    configurable: true,
    value: "https://studio.example/studio",
  });
  const game = observationFixture(window);
  const topology = resolveProjectRuntimeTopology({
    runtimeMode: "standalone-dev",
    surfaceRole: "host",
    appOrigin: "https://game.example",
    embedded: true,
    embedParentOrigin: "https://studio.example",
  });
  const inspection = createHostRuntimeInspectionContract({
    roomId: "ROOM",
    joinUrl: "https://game.example/controller?room=ROOM",
    joinUrlStatus: "ready",
    connectionStatus: "connected",
    players: [],
    controllers: [],
    mode: "standalone",
    runtimeState: "playing",
  });
  const send = (
    source = parent,
    origin = "https://studio.example",
    request = game.request,
  ) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source,
        origin,
        data: {
          type: "AIRJAM_HOST_OBSERVE",
          requestId: "capture-one",
          request,
        },
      }),
    );
  return { ...game, parent, topology, inspection, send };
}

describe("delegated read-only host observation", () => {
  it.each(["", "https://game.example/after-reload"])(
    "keeps the explicit observer boundary after referrer becomes %s",
    async (referrer) => {
      const game = bridgeFixture();
      Object.defineProperty(document, "referrer", {
        configurable: true,
        value: referrer,
      });
      const stop = publishEmbeddedHostObservation(
        game.inspection,
        game.topology,
      );
      expect(stop.supported).toBe(true);
      game.send(game.parent, "https://game.example");
      expect(game.parent.postMessage).not.toHaveBeenCalled();
      game.send();
      await vi.waitFor(() =>
        expect(game.parent.postMessage).toHaveBeenCalledOnce(),
      );
      expect(game.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AIRJAM_HOST_OBSERVATION",
          result: expect.objectContaining({ ok: true }),
        }),
        "https://studio.example",
      );
      stop.close();
      game.close();
    },
  );

  it("binds both message directions to exact origins/windows and exposes no host-control operation", async () => {
    const game = bridgeFixture();
    const stop = publishEmbeddedHostObservation(game.inspection, game.topology);
    game.send(window);
    game.send(game.parent, "https://attacker.example");
    expect(game.parent.postMessage).not.toHaveBeenCalled();
    game.send();
    await vi.waitFor(() =>
      expect(game.parent.postMessage).toHaveBeenCalledTimes(1),
    );
    const [data, origin] = vi.mocked(game.parent.postMessage).mock.calls[0];
    expect(origin).toBe("https://studio.example");
    const event = new MessageEvent("message", {
      source: window,
      origin: "https://game.example",
      data,
    });
    expect(
      readHostObservation(event, window, "https://game.example")?.result,
    ).toMatchObject({ ok: true, observation: { snapshot: { score: 2 } } });
    expect(
      readHostObservation(event, game.parent, "https://game.example"),
    ).toBeNull();
    expect(
      readHostObservation(event, window, "https://attacker.example"),
    ).toBeNull();
    game.send(game.parent, "https://studio.example", {
      ...game.request,
      operation: "invoke-host",
    } as typeof game.request);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(game.parent.postMessage).toHaveBeenCalledTimes(1);
    expect(game.invoke).not.toHaveBeenCalled();
    stop.close();
    game.close();
  });

  it("requires explicit development embedding and its configured parent", async () => {
    const game = bridgeFixture();
    for (const topology of [
      { ...game.topology, embedded: false, embedParentOrigin: undefined },
      { ...game.topology, embedParentOrigin: "https://attacker.example" },
      { ...game.topology, runtimeMode: "hosted-release" as const },
    ]) {
      const stop = publishEmbeddedHostObservation(game.inspection, topology);
      game.send();
      stop.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(game.parent.postMessage).not.toHaveBeenCalled();
    game.close();
  });

  it("rejects the wrong room and suppresses an async response after unmount", async () => {
    const game = bridgeFixture();
    const stop = publishEmbeddedHostObservation(game.inspection, game.topology);
    game.send(game.parent, "https://studio.example", {
      ...game.request,
      roomId: "OTHER",
    });
    expect(vi.mocked(game.parent.postMessage).mock.calls[0][0]).toMatchObject({
      result: {
        ok: false,
        error: expect.stringContaining("observation_replaced"),
      },
    });
    game.send();
    stop.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(game.parent.postMessage).toHaveBeenCalledTimes(1);
    game.close();
  });

  it("sends only a validated bounded read request to the supplied game origin", () => {
    const game = bridgeFixture();
    requestHostObservation(
      game.parent,
      "https://game.example",
      "capture-one",
      game.request,
    );
    expect(game.parent.postMessage).toHaveBeenCalledWith(
      {
        type: "AIRJAM_HOST_OBSERVE",
        requestId: "capture-one",
        request: game.request,
      },
      "https://game.example",
    );
    game.close();
  });
});
