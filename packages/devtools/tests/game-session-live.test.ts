import type { HostAgentRequest } from "@air-jam/sdk/runtime-control";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeGameSession,
  invokeGameSessionAction,
  openGameSession,
  readGameSession,
} from "../src/game-session.js";
const io = vi.hoisted(() => ({
  request: vi.fn(),
  invoke: vi.fn(),
  disconnect: vi.fn(),
}));
const summary = {
  controllerSessionId: "controller",
  gameId: "test",
  projectMode: "standalone-game",
  mode: "standalone-dev",
  topologyMode: "standalone-dev",
  secure: false,
  process: null,
  roomId: "ROOM",
  controllerId: "player",
  deviceId: "device",
  controllerJoinUrl: "http://localhost/controller?room=ROOM",
  socketOrigin: "http://localhost",
  connected: true,
  connectedAt: "now",
  disconnectedAt: null,
  disconnectReason: null,
};
vi.mock("../src/controller.js", () => ({
  connectController: async () => ({ ...summary }),
  resolveControllerSessionGameRuntime: async () => ({
    gameId: "test",
    defaultStoreDomain: "default",
  }),
  ownsControllerSessionHost: () => true,
  requestControllerHostAgent: (...args: unknown[]) => io.request(...args),
  invokeControllerAction: (...args: unknown[]) => io.invoke(...args),
  readRuntimeSnapshot: async () => ({ ...summary }),
  disconnectController: (...args: unknown[]) => io.disconnect(...args),
  sendControllerInput: vi.fn(),
  captureControllerSessionVisuals: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  io.disconnect.mockResolvedValue({
    disconnected: true,
    session: { ...summary, connected: false },
  });
});
function fixture() {
  let score = 0,
    revision = 0,
    contractId = "one";
  const actions = [
    {
      actionId: "score",
      target: {
        kind: "participant",
        actionName: "score",
        storeDomain: "default",
      },
      description: null,
      availability: null,
      payload: { kind: "number", description: null },
      resultDescription: null,
    },
    {
      actionId: "finish",
      target: { kind: "host", actionName: "finish", storeDomain: "default" },
      description: null,
      availability: null,
      payload: { kind: "none", description: null },
      resultDescription: null,
    },
  ];
  io.request.mockImplementation(
    async (_id: string, request: HostAgentRequest) => {
      if (request.operation === "read")
        return {
          operation: "read",
          snapshot: {
            contractId,
            runtimeId: "runtime",
            snapshotStoreDomains: ["default"],
            snapshotDescription: null,
            actions,
            snapshot: { score },
            rawStores: [
              {
                storeDomain: "default",
                data: { score },
                revision,
                updatedAt: "now",
              },
            ],
            storeDomainBindings: [
              { contractStoreDomain: "default", runtimeStoreDomain: "default" },
            ],
          },
        };
      if (request.operation === "invoke-host") {
        score = 10;
        revision++;
        return {
          operation: "invoke-host",
          target: actions[1].target,
          acknowledgement: { ok: true, status: "accepted", source: "host" },
        };
      }
      return {
        operation: "resolve",
        target: actions[0].target,
        payload: { score: request.payload },
      };
    },
  );
  io.invoke.mockImplementation(
    async (request: { payload: { score: number } }) => {
      score = request.payload.score;
      revision++;
      return {
        acknowledgement: { ok: true, status: "accepted", source: "host" },
      };
    },
  );
  return {
    replace: () => {
      contractId = "replacement";
    },
  };
}
const open = () =>
  openGameSession({
    controllerJoinUrl: "http://localhost/controller?room=ROOM",
  });
describe("live semantic session", () => {
  it("uses one evaluation path and observes both real transport lanes", async () => {
    fixture();
    const session = await open();
    expect(session.actions).toHaveLength(2);
    const player = await invokeGameSessionAction({
      gameSessionId: session.gameSessionId,
      actionId: "player:score",
      payload: 3,
    });
    expect(player.invocation).toMatchObject({
      outcome: "accepted",
      snapshotBefore: { snapshot: { score: 0 } },
      snapshotAfter: { snapshot: { score: 3 } },
    });
    expect(io.invoke).toHaveBeenCalledTimes(1);
    const host = await invokeGameSessionAction({
      gameSessionId: session.gameSessionId,
      actionId: "host:finish",
    });
    expect(host.invocation.snapshotAfter.snapshot.score).toBe(10);
    expect(io.invoke).toHaveBeenCalledTimes(1);
    await closeGameSession({ gameSessionId: session.gameSessionId });
  });
  it("refreshes the live contract and does not compare snapshots across a replacement", async () => {
    const f = fixture();
    const session = await open();
    const originalInvoke = io.invoke.getMockImplementation();
    io.invoke.mockImplementationOnce(async (request) => {
      const result = await originalInvoke?.(request);
      f.replace();
      return result;
    });
    const result = await invokeGameSessionAction({
      gameSessionId: session.gameSessionId,
      actionId: "player:score",
      payload: 3,
    });
    expect(result.invocation.outcome).toBe("contract_changed");
    expect(result.invocation.observedStateChange).toBe(false);
    expect(
      (await readGameSession({ gameSessionId: session.gameSessionId }))
        .gameSnapshot?.contractId,
    ).not.toBe(result.invocation.snapshotBefore.contractId);
    await closeGameSession({ gameSessionId: session.gameSessionId });
  });
  it("propagates contract failures instead of opening a contractless session", async () => {
    fixture();
    io.request.mockRejectedValueOnce(new Error("authored projection failed"));
    await expect(open()).rejects.toThrow("authored projection failed");
    expect(io.disconnect).toHaveBeenCalledTimes(1);
  });
});
