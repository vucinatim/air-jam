// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentActionInput } from "../src/agent/agent-action";
import { agentAction } from "../src/agent/agent-contract";
import { resolveProjectRuntimeTopology } from "../src/runtime-topology";
import type { HostAgentRequest } from "../src/runtime/contracts/agent-control";
import { createHostRuntimeInspectionContract } from "../src/runtime/contracts/inspection";
import {
  publishEmbeddedHostAgent,
  readHostAgentResult,
  requestHostAgent,
} from "../src/runtime/host-agent-bridge";
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
  const game = observationFixture(window, {
    finishMatch: agentAction.host(
      { actionName: "finishMatch", storeDomain: "default" },
      {
        input: agentActionInput.none(),
        description: "Finish the match.",
        resultDescription: "The match ends.",
      },
    ),
  });
  const observe: HostAgentRequest = { operation: "observe", ...game.request };
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
    request: unknown = observe,
  ) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source,
        origin,
        data: {
          type: "AIRJAM_HOST_AGENT",
          requestId: "capture-one",
          request,
        },
      }),
    );
  return { ...game, observe, parent, topology, inspection, send };
}

describe("delegated host agent requests", () => {
  it.each(["", "https://game.example/after-reload"])(
    "keeps the explicit observer boundary after referrer becomes %s",
    async (referrer) => {
      const game = bridgeFixture();
      Object.defineProperty(document, "referrer", {
        configurable: true,
        value: referrer,
      });
      const stop = publishEmbeddedHostAgent(game.inspection, game.topology);
      expect(stop.supported).toBe(true);
      game.send(game.parent, "https://game.example");
      expect(game.parent.postMessage).not.toHaveBeenCalled();
      game.send();
      await vi.waitFor(() =>
        expect(game.parent.postMessage).toHaveBeenCalledOnce(),
      );
      expect(game.parent.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "AIRJAM_HOST_AGENT_RESULT",
          result: expect.objectContaining({ ok: true }),
        }),
        "https://studio.example",
      );
      stop.close();
      game.close();
    },
  );

  it("binds both message directions to exact origins and windows", async () => {
    const game = bridgeFixture();
    const stop = publishEmbeddedHostAgent(game.inspection, game.topology);
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
      readHostAgentResult(event, window, "https://game.example")?.result,
    ).toMatchObject({
      ok: true,
      response: {
        operation: "observe",
        observation: { snapshot: { score: 2 } },
      },
    });
    expect(
      readHostAgentResult(event, game.parent, "https://game.example"),
    ).toBeNull();
    expect(
      readHostAgentResult(event, window, "https://attacker.example"),
    ).toBeNull();
    stop.close();
    game.close();
  });

  it("reads live state and runs the game's own host action for its parent", async () => {
    const game = bridgeFixture();
    const stop = publishEmbeddedHostAgent(game.inspection, game.topology);
    game.send(game.parent, "https://studio.example", {
      operation: "read",
      roomId: "ROOM",
      controllerId: null,
    });
    await vi.waitFor(() =>
      expect(game.parent.postMessage).toHaveBeenCalledTimes(1),
    );
    const read = vi.mocked(game.parent.postMessage).mock.calls[0][0];
    expect(read).toMatchObject({
      result: { ok: true, response: { operation: "read" } },
    });
    const snapshot = read.result.response.snapshot;
    game.invoke.mockResolvedValue({
      ok: true,
      status: "accepted",
      source: "host",
    });
    game.send(game.parent, "https://studio.example", {
      operation: "invoke-host",
      roomId: "ROOM",
      controllerId: "host",
      contractId: snapshot.contractId,
      runtimeId: snapshot.runtimeId,
      actionId: "finishMatch",
    });
    await vi.waitFor(() =>
      expect(game.parent.postMessage).toHaveBeenCalledTimes(2),
    );
    expect(game.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: "ROOM", actionName: "finishMatch" }),
    );
    expect(vi.mocked(game.parent.postMessage).mock.calls[1][0]).toMatchObject({
      result: {
        ok: true,
        response: {
          operation: "invoke-host",
          acknowledgement: { ok: true, status: "accepted" },
        },
      },
    });
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
      const stop = publishEmbeddedHostAgent(game.inspection, topology);
      game.send();
      stop.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(game.parent.postMessage).not.toHaveBeenCalled();
    game.close();
  });

  it("rejects the wrong room and suppresses an async response after unmount", async () => {
    const game = bridgeFixture();
    const stop = publishEmbeddedHostAgent(game.inspection, game.topology);
    game.send(game.parent, "https://studio.example", {
      ...game.observe,
      roomId: "OTHER",
    });
    expect(vi.mocked(game.parent.postMessage).mock.calls[0][0]).toMatchObject({
      result: {
        ok: false,
        error: expect.stringContaining("runtime_replaced"),
      },
    });
    game.send();
    stop.close();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(game.parent.postMessage).toHaveBeenCalledTimes(1);
    game.close();
  });

  it("sends only a validated request to the supplied game origin", () => {
    const game = bridgeFixture();
    requestHostAgent(
      game.parent,
      "https://game.example",
      "capture-one",
      game.observe,
    );
    expect(game.parent.postMessage).toHaveBeenCalledWith(
      {
        type: "AIRJAM_HOST_AGENT",
        requestId: "capture-one",
        request: game.observe,
      },
      "https://game.example",
    );
    game.close();
  });
});
